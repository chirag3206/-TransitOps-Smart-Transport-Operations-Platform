/**
 * TransitOps — Driver Controller
 * Full CRUD + business rules:
 *  - Unique license number
 *  - Cannot dispatch with expired license
 *  - Cannot delete driver On Trip
 *  - License expiry alerts
 *  - Safety score updates
 *  - Search, filter, sort, paginate
 */
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, parsePagination, parseSort } = require('../utils/apiResponse');
const { bustCache } = require('../utils/cacheHelpers');
const {
  DRIVER_STATUS,
  DRIVER_BLOCKED_STATUSES,
  TRIP_STATUS,
  LICENSE_EXPIRY_WARNING_DAYS,
} = require('../utils/constants');

const SORT_FIELDS = ['name', 'status', 'licenseExpiryDate', 'safetyScore', 'totalTrips', 'createdAt'];

// ─────────────────────────────────────────────
// GET /api/drivers
// ─────────────────────────────────────────────
const getDrivers = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, SORT_FIELDS);
  const now = new Date();

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.licenseCategory) filter.licenseCategory = req.query.licenseCategory;
  if (req.query.region) filter.region = req.query.region;

  // License status filter using date arithmetic
  if (req.query.licenseStatus === 'expired') {
    filter.licenseExpiryDate = { $lt: now };
  } else if (req.query.licenseStatus === 'expiring_soon') {
    const threshold = new Date(now.getTime() + LICENSE_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
    filter.licenseExpiryDate = { $gte: now, $lte: threshold };
  } else if (req.query.licenseStatus === 'valid') {
    const threshold = new Date(now.getTime() + LICENSE_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
    filter.licenseExpiryDate = { $gt: threshold };
  }

  // Text search across name, contact, license
  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [
      { name: regex },
      { licenseNumber: regex },
      { contactNumber: regex },
    ];
  }

  const [drivers, total] = await Promise.all([
    Driver.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    Driver.countDocuments(filter),
  ]);

  sendPaginated(res, drivers, total, page, limit, 'Drivers retrieved successfully');
};

// ─────────────────────────────────────────────
// GET /api/drivers/available
// ─────────────────────────────────────────────
const getAvailableDrivers = async (req, res) => {
  const drivers = await Driver.findAvailable({
    ...(req.query.licenseCategory && { licenseCategory: req.query.licenseCategory }),
    ...(req.query.region && { region: req.query.region }),
  }).lean({ virtuals: true });

  sendSuccess(res, 200, 'Available drivers retrieved', drivers);
};

// ─────────────────────────────────────────────
// GET /api/drivers/expiring-licenses
// License expiry alert for Safety Officers
// ─────────────────────────────────────────────
const getExpiringLicenses = async (req, res) => {
  const days = parseInt(req.query.days, 10) || LICENSE_EXPIRY_WARNING_DAYS;
  const drivers = await Driver.findExpiringLicenses(days).lean({ virtuals: true });

  sendSuccess(res, 200, `Drivers with licenses expiring within ${days} days`, {
    count: drivers.length,
    drivers,
  });
};

// ─────────────────────────────────────────────
// GET /api/drivers/:id
// ─────────────────────────────────────────────
const getDriverById = async (req, res, next) => {
  const driver = await Driver.findById(req.params.id).lean({ virtuals: true });
  if (!driver) return next(new ApiError(404, `Driver not found`));
  sendSuccess(res, 200, 'Driver retrieved successfully', driver);
};

// ─────────────────────────────────────────────
// POST /api/drivers
// ─────────────────────────────────────────────
const createDriver = async (req, res, next) => {
  const { licenseNumber, licenseExpiryDate } = req.body;

  // Business rule: license number must be unique
  const taken = await Driver.isLicenseTaken(licenseNumber);
  if (taken) {
    return next(new ApiError(409, `License number '${licenseNumber.toUpperCase()}' is already registered`));
  }

  // Business rule: warn if creating driver with already-expired license
  if (new Date(licenseExpiryDate) < new Date()) {
    return next(new ApiError(400, 'Cannot register a driver with an already-expired license. Update the license first.'));
  }

  const driver = await Driver.create({
    ...req.body,
    licenseNumber: licenseNumber.toUpperCase().trim(),
  });

  bustCache.drivers();
  sendSuccess(res, 201, 'Driver registered successfully', driver.toObject({ virtuals: true }));
};

// ─────────────────────────────────────────────
// PUT /api/drivers/:id
// ─────────────────────────────────────────────
const updateDriver = async (req, res, next) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return next(new ApiError(404, 'Driver not found'));

  // Business rule: check unique license number if changing it
  if (req.body.licenseNumber) {
    const newLicense = req.body.licenseNumber.toUpperCase().trim();
    if (newLicense !== driver.licenseNumber) {
      const taken = await Driver.isLicenseTaken(newLicense, driver._id);
      if (taken) return next(new ApiError(409, `License number '${newLicense}' is already registered`));
      req.body.licenseNumber = newLicense;
    }
  }

  // Business rule: cannot manually set to On Trip
  if (req.body.status === DRIVER_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'Cannot manually set driver status to "On Trip". Use the trip dispatch workflow.'));
  }

  const updated = await Driver.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true, returnDocument: 'after' }
  ).lean({ virtuals: true });

  bustCache.drivers();
  sendSuccess(res, 200, 'Driver updated successfully', updated);
};

// ─────────────────────────────────────────────
// DELETE /api/drivers/:id
// ─────────────────────────────────────────────
const deleteDriver = async (req, res, next) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return next(new ApiError(404, 'Driver not found'));

  // Business rule: cannot delete a driver currently on a trip
  if (driver.status === DRIVER_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'Cannot delete a driver who is currently On Trip. Complete or cancel the trip first.'));
  }

  // Business rule: preserve history if driver has trips
  const tripCount = await Trip.countDocuments({ driver: req.params.id });
  if (tripCount > 0) {
    // Soft delete — suspend instead of hard delete
    await Driver.findByIdAndUpdate(req.params.id, { status: DRIVER_STATUS.SUSPENDED });
    bustCache.drivers();
    return sendSuccess(res, 200, 'Driver has trip history and has been suspended instead of deleted to preserve data integrity.');
  }

  await Driver.findByIdAndDelete(req.params.id);
  bustCache.drivers();
  sendSuccess(res, 200, 'Driver deleted successfully');
};

// ─────────────────────────────────────────────
// PATCH /api/drivers/:id/status
// ─────────────────────────────────────────────
const updateDriverStatus = async (req, res, next) => {
  const { status } = req.body;

  if (!status || !Object.values(DRIVER_STATUS).includes(status)) {
    return next(new ApiError(400, `Valid status required: ${Object.values(DRIVER_STATUS).join(', ')}`));
  }

  const driver = await Driver.findById(req.params.id);
  if (!driver) return next(new ApiError(404, 'Driver not found'));

  if (status === DRIVER_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'Use the trip dispatch workflow to set a driver On Trip'));
  }

  if (driver.status === DRIVER_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'An On Trip driver\'s status can only be changed via trip completion or cancellation'));
  }

  driver.status = status;
  await driver.save();

  bustCache.drivers();
  sendSuccess(res, 200, `Driver status updated to '${status}'`, driver.toObject({ virtuals: true }));
};

// ─────────────────────────────────────────────
// PATCH /api/drivers/:id/safety-score
// Safety Officer only
// ─────────────────────────────────────────────
const updateSafetyScore = async (req, res, next) => {
  const { score, reason } = req.body;

  if (score === undefined || score < 0 || score > 100) {
    return next(new ApiError(400, 'Safety score must be between 0 and 100'));
  }

  const driver = await Driver.findById(req.params.id);
  if (!driver) return next(new ApiError(404, 'Driver not found'));

  const previousScore = driver.safetyScore;
  driver.safetyScore = parseFloat(score);
  await driver.save();

  bustCache.drivers();
  sendSuccess(res, 200, 'Safety score updated', {
    driverId: driver._id,
    name: driver.name,
    previousScore,
    newScore: driver.safetyScore,
    reason: reason || null,
  });
};

// ─────────────────────────────────────────────
// GET /api/drivers/:id/summary
// Per-driver trip history and performance
// ─────────────────────────────────────────────
const getDriverSummary = async (req, res, next) => {
  const driver = await Driver.findById(req.params.id).lean({ virtuals: true });
  if (!driver) return next(new ApiError(404, 'Driver not found'));

  const [recentTrips, activeTrip] = await Promise.all([
    Trip.find({ driver: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('vehicle', 'registrationNumber name type')
      .lean(),
    Trip.findOne({ driver: req.params.id, status: TRIP_STATUS.DISPATCHED })
      .populate('vehicle', 'registrationNumber name')
      .lean(),
  ]);

  sendSuccess(res, 200, 'Driver summary retrieved', {
    driver,
    recentTrips,
    activeTrip,
    licenseAlert: driver.licenseStatus !== 'valid'
      ? { status: driver.licenseStatus, daysUntilExpiry: driver.daysUntilExpiry }
      : null,
  });
};

module.exports = {
  getDrivers,
  getAvailableDrivers,
  getExpiringLicenses,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  updateDriverStatus,
  updateSafetyScore,
  getDriverSummary,
};
