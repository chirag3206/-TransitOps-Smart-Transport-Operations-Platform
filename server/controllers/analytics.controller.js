/**
 * TransitOps — Analytics Controller
 *
 * Endpoints:
 *  GET /api/analytics/dashboard        - Live KPI summary (fleet health, trips, revenue)
 *  GET /api/analytics/fleet-utilization - Vehicle status breakdown + utilization rate
 *  GET /api/analytics/trip-performance  - Trip stats: completed/cancelled/active, avg distance, revenue
 *  GET /api/analytics/cost-breakdown    - Total costs by category (fuel, maintenance, expenses)
 *  GET /api/analytics/driver-stats      - Driver performance: trips, distance, safety scores
 *  GET /api/analytics/monthly-trend     - Month-by-month revenue, cost, trips (rolling 12 months)
 */
const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const Maintenance = require('../models/Maintenance');
const FuelLog = require('../models/FuelLog');
const Expense = require('../models/Expense');
const { sendSuccess } = require('../utils/apiResponse');

// ─────────────────────────────────────────────────
// Helper: build a date range match stage
// ─────────────────────────────────────────────────
const dateRange = (field, fromDate, toDate) => {
  if (!fromDate && !toDate) return {};
  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) range.$lte = new Date(toDate);
  return { [field]: range };
};

// ─────────────────────────────────────────────────
// GET /api/analytics/dashboard
// One-shot KPI card data for the fleet manager dashboard
// ─────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  if (req.user.role === 'driver') {
    const driver = await Driver.findOne({ email: req.user.email }).lean({ virtuals: true });
    if (!driver) {
      return sendSuccess(res, 200, 'Driver profile not found', { role: 'driver', driver: null });
    }

    const [activeTrips, upcomingTrip, pendingTrip, completedTripsCount, totalDistanceResult] = await Promise.all([
      // Trips that are Dispatched or In Progress (driver needs to act)
      Trip.find({ driver: driver._id, status: { $in: ['Dispatched', 'In Progress'] } })
        .populate('vehicle', 'registrationNumber name type make model odometer')
        .lean({ virtuals: true }),
      // Draft trips (upcoming, assigned but not yet dispatched)
      Trip.findOne({ driver: driver._id, status: 'Draft' })
        .populate('vehicle', 'registrationNumber name type make model odometer')
        .lean({ virtuals: true }),
      // Trips pending manager approval
      Trip.findOne({ driver: driver._id, status: 'Pending Completion' })
        .populate('vehicle', 'registrationNumber name type make model odometer')
        .lean({ virtuals: true }),
      Trip.countDocuments({ driver: driver._id, status: 'Completed' }),
      Trip.aggregate([
        { $match: { driver: driver._id, status: 'Completed' } },
        { $group: { _id: null, totalDistance: { $sum: '$actualDistance' } } }
      ])
    ]);

    // Pick the most relevant active trip (In Progress first, then Dispatched)
    const inProgressTrip = activeTrips.find(t => t.status === 'In Progress') || null;
    const dispatchedTrip = activeTrips.find(t => t.status === 'Dispatched') || null;
    const activeTrip = inProgressTrip || dispatchedTrip;

    const totalDistance = totalDistanceResult[0]?.totalDistance || driver.totalDistance || 0;
    const diff = driver.licenseExpiryDate ? new Date(driver.licenseExpiryDate) - new Date() : 0;
    const daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return sendSuccess(res, 200, 'Driver dashboard data retrieved', {
      role: 'driver',
      driver: { ...driver, daysUntilExpiry },
      stats: {
        completedTrips: completedTripsCount || driver.completedTrips || 0,
        totalDistance: Math.round(totalDistance),
        safetyScore: driver.safetyScore,
      },
      activeTrip,
      upcomingTrip,
      pendingTrip,
    });
  }

  const [
    vehicleStats,
    driverStats,
    tripStats,
    financials,
    activeMaintenance,
    recentTrips,
    licenseAlerts,
  ] = await Promise.all([
    // Vehicle status counts
    Vehicle.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Driver status counts
    Driver.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Trip status counts
    Trip.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Revenue & cost totals
    Promise.all([
      Trip.aggregate([
        { $match: { status: 'Completed', revenue: { $gt: 0 } } },
        { $group: { _id: null, totalRevenue: { $sum: '$revenue' }, avgDistance: { $avg: '$computedDistance' } } },
      ]),
      FuelLog.aggregate([
        { $group: { _id: null, totalFuelCost: { $sum: '$totalCost' }, totalLiters: { $sum: '$liters' } } },
      ]),
      Maintenance.aggregate([
        { $match: { status: 'Closed' } },
        { $group: { _id: null, totalMaintenanceCost: { $sum: '$actualCost' } } },
      ]),
      Expense.aggregate([
        { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
      ]),
    ]),

    // Active maintenance count (pending approval or in workshop)
    Maintenance.countDocuments({ status: { $in: ['Pending Approval', 'In Workshop'] } }),

    // 5 most recent active/completed trips
    Trip.find({ status: { $in: ['Dispatched', 'In Progress', 'Pending Completion', 'Completed'] } })
      .sort({ updatedAt: -1 }).limit(5)
      .populate('vehicle', 'registrationNumber name')
      .populate('driver', 'name')
      .select('source destination status revenue computedDistance createdAt')
      .lean(),

    // Drivers with license expiring in 30 days
    Driver.find({
      licenseExpiryDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      status: { $ne: 'Suspended' },
    }).select('name licenseNumber licenseExpiryDate safetyScore status').lean(),
  ]);

  // Normalize vehicle stats into a map
  const vMap = Object.fromEntries(vehicleStats.map((v) => [v._id, v.count]));
  const dMap = Object.fromEntries(driverStats.map((d) => [d._id, d.count]));
  const tMap = Object.fromEntries(tripStats.map((t) => [t._id, t.count]));

  const [tripFinancials, fuelFinancials, maintenanceFinancials, expenseFinancials] = financials;

  const totalRevenue = tripFinancials[0]?.totalRevenue || 0;
  const totalFuelCost = fuelFinancials[0]?.totalFuelCost || 0;
  const totalMaintenanceCost = maintenanceFinancials[0]?.totalMaintenanceCost || 0;
  const totalExpenses = expenseFinancials[0]?.totalExpenses || 0;
  const totalCosts = totalFuelCost + totalMaintenanceCost + totalExpenses;
  const netProfit = totalRevenue - totalCosts;

  const totalVehicles = Object.values(vMap).reduce((a, b) => a + b, 0);
  const availableVehicles = vMap['Available'] || 0;
  const utilizationRate = totalVehicles > 0
    ? parseFloat(((totalVehicles - availableVehicles) / totalVehicles * 100).toFixed(1))
    : 0;

  sendSuccess(res, 200, 'Dashboard data retrieved', {
    fleet: {
      total: totalVehicles,
      available: vMap['Available'] || 0,
      onTrip: vMap['On Trip'] || 0,
      pendingMaintenance: vMap['Pending Maintenance'] || 0,
      inShop: vMap['In Shop'] || 0,
      retired: vMap['Retired'] || 0,
      utilizationRate,
    },
    drivers: {
      total: Object.values(dMap).reduce((a, b) => a + b, 0),
      available: dMap['Available'] || 0,
      onTrip: dMap['On Trip'] || 0,
      suspended: dMap['Suspended'] || 0,
    },
    trips: {
      total: Object.values(tMap).reduce((a, b) => a + b, 0),
      draft: tMap['Draft'] || 0,
      dispatched: (tMap['Dispatched'] || 0) + (tMap['In Progress'] || 0) + (tMap['Pending Completion'] || 0),
      completed: tMap['Completed'] || 0,
      cancelled: tMap['Cancelled'] || 0,
    },
    financials: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCosts: parseFloat(totalCosts.toFixed(2)),
      totalFuelCost: parseFloat(totalFuelCost.toFixed(2)),
      totalMaintenanceCost: parseFloat(totalMaintenanceCost.toFixed(2)),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      // Map to expected frontend dashboard keys
      fuelCosts: parseFloat(totalFuelCost.toFixed(2)),
      maintenanceCosts: parseFloat(totalMaintenanceCost.toFixed(2)),
      otherExpenses: parseFloat(totalExpenses.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      profitMargin: totalRevenue > 0
        ? parseFloat((netProfit / totalRevenue * 100).toFixed(1))
        : 0,
    },
    activeMaintenance,
    recentActivity: recentTrips,
    licenseAlerts,
    generatedAt: new Date().toISOString(),
  });
};

// ─────────────────────────────────────────────────
// GET /api/analytics/fleet-utilization
// Detailed breakdown of every vehicle's usage
// ─────────────────────────────────────────────────
const getFleetUtilization = async (req, res) => {
  const { fromDate, toDate } = req.query;
  const tripMatch = { status: 'Completed', ...dateRange('completedAt', fromDate, toDate) };

  const [statusBreakdown, perVehicle] = await Promise.all([
    // Status distribution
    Vehicle.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Per-vehicle trip/revenue/distance stats
    Trip.aggregate([
      { $match: tripMatch },
      {
        $group: {
          _id: '$vehicle',
          tripsCompleted: { $sum: 1 },
          totalRevenue: { $sum: '$revenue' },
          totalDistance: { $sum: '$computedDistance' },
          avgDistance: { $avg: '$computedDistance' },
          totalCargoWeight: { $sum: '$cargoWeight' },
        },
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_id',
          foreignField: '_id',
          as: 'vehicle',
        },
      },
      { $unwind: '$vehicle' },
      {
        $project: {
          vehicleId: '$_id',
          registrationNumber: '$vehicle.registrationNumber',
          vehicleName: '$vehicle.name',
          type: '$vehicle.type',
          status: '$vehicle.status',
          maxLoadCapacity: '$vehicle.maxLoadCapacity',
          tripsCompleted: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDistance: { $round: ['$totalDistance', 1] },
          avgDistance: { $round: ['$avgDistance', 1] },
          totalCargoWeight: 1,
        },
      },
      { $sort: { tripsCompleted: -1 } },
    ]),
  ]);

  const total = statusBreakdown.reduce((s, g) => s + g.count, 0);
  const available = statusBreakdown.find((s) => s._id === 'Available')?.count || 0;

  sendSuccess(res, 200, 'Fleet utilization retrieved', {
    summary: {
      totalVehicles: total,
      utilizationRate: total > 0
        ? parseFloat(((total - available) / total * 100).toFixed(1))
        : 0,
      statusBreakdown,
    },
    perVehicle,
  });
};

// ─────────────────────────────────────────────────
// GET /api/analytics/trip-performance
// Trip metrics: completion rate, avg distance, revenue per km
// ─────────────────────────────────────────────────
const getTripPerformance = async (req, res) => {
  const { fromDate, toDate } = req.query;
  const match = { ...dateRange('createdAt', fromDate, toDate) };

  const [statusBreakdown, revenueByRoute, topDrivers] = await Promise.all([
    // Status + totals
    Trip.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$revenue' },
          totalDistance: { $sum: '$computedDistance' },
          avgCargoWeight: { $avg: '$cargoWeight' },
        },
      },
    ]),

    // Top 10 routes by revenue
    Trip.aggregate([
      { $match: { ...match, status: 'Completed' } },
      {
        $group: {
          _id: { source: '$source', destination: '$destination' },
          trips: { $sum: 1 },
          totalRevenue: { $sum: '$revenue' },
          avgRevenue: { $avg: '$revenue' },
          avgDistance: { $avg: '$computedDistance' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          route: { $concat: ['$_id.source', ' → ', '$_id.destination'] },
          trips: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          avgRevenue: { $round: ['$avgRevenue', 2] },
          avgDistance: { $round: ['$avgDistance', 1] },
        },
      },
    ]),

    // Top 10 drivers by trips completed
    Trip.aggregate([
      { $match: { ...match, status: 'Completed' } },
      {
        $group: {
          _id: '$driver',
          tripsCompleted: { $sum: 1 },
          totalRevenue: { $sum: '$revenue' },
          totalDistance: { $sum: '$computedDistance' },
        },
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driver',
        },
      },
      { $unwind: '$driver' },
      {
        $project: {
          driverName: '$driver.name',
          safetyScore: '$driver.safetyScore',
          tripsCompleted: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDistance: { $round: ['$totalDistance', 1] },
        },
      },
      { $sort: { tripsCompleted: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const totals = {
    total: 0, completed: 0, cancelled: 0, dispatched: 0, draft: 0,
    totalRevenue: 0, totalDistance: 0,
  };

  for (const s of statusBreakdown) {
    totals.total += s.count;
    totals[s._id.toLowerCase()] = s.count;
    totals.totalRevenue += s.totalRevenue || 0;
    totals.totalDistance += s.totalDistance || 0;
  }

  sendSuccess(res, 200, 'Trip performance retrieved', {
    summary: {
      ...totals,
      completionRate: totals.total > 0
        ? parseFloat((totals.completed / totals.total * 100).toFixed(1))
        : 0,
      cancellationRate: totals.total > 0
        ? parseFloat((totals.cancelled / totals.total * 100).toFixed(1))
        : 0,
      totalRevenue: parseFloat(totals.totalRevenue.toFixed(2)),
      totalDistance: parseFloat(totals.totalDistance.toFixed(1)),
      revenuePerKm: totals.totalDistance > 0
        ? parseFloat((totals.totalRevenue / totals.totalDistance).toFixed(2))
        : 0,
    },
    topRoutes: revenueByRoute,
    topDrivers,
  });
};

// ─────────────────────────────────────────────────
// GET /api/analytics/cost-breakdown
// Operational cost analysis across all categories
// ─────────────────────────────────────────────────
const getCostBreakdown = async (req, res) => {
  const [fuelByVehicle, expenseByCategory, maintenanceByType, costTrend] = await Promise.all([
    // Fuel cost per vehicle (top 10) — totals only, no date arithmetic
    FuelLog.aggregate([
      { $group: { _id: '$vehicle', totalLiters: { $sum: '$liters' }, totalCost: { $sum: '$totalCost' }, fillUps: { $sum: 1 } } },
      { $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'v' } },
      { $unwind: '$v' },
      {
        $project: {
          registrationNumber: '$v.registrationNumber', vehicleName: '$v.name',
          totalLiters: 1, totalCost: { $round: ['$totalCost', 2] },
          avgLitersPerFillup: { $round: [{ $divide: ['$totalLiters', { $add: ['$fillUps', 0.001] }] }, 2] },
          fillUps: 1,
        },
      },
      { $sort: { totalCost: -1 } },
      { $limit: 10 },
    ]),

    // Expenses by category — totals only
    Expense.aggregate([
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),

    // Maintenance cost by type
    Maintenance.aggregate([
      { $match: { status: 'Closed' } },
      { $group: { _id: '$type', totalCost: { $sum: '$actualCost' }, count: { $sum: 1 } } },
      { $sort: { totalCost: -1 } },
    ]),

    // Monthly cost trend (use createdAt — always a reliable Date set by Mongoose)
    Promise.all([
      FuelLog.aggregate([
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, fuelCost: { $sum: '$totalCost' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }, { $limit: 6 },
      ]),
      Expense.aggregate([
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, expenseCost: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }, { $limit: 6 },
      ]),
    ]),
  ]);

  const [fuelTrend, expTrend] = costTrend;

  sendSuccess(res, 200, 'Cost breakdown retrieved', {
    fuelByVehicle,
    expenseByCategory,
    maintenanceByType,
    monthlyTrend: { fuel: fuelTrend, expenses: expTrend },
  });
};

// ─────────────────────────────────────────────────
// GET /api/analytics/driver-stats
// Driver performance leaderboard
// ─────────────────────────────────────────────────
const getDriverStats = async (req, res) => {
  const { fromDate, toDate } = req.query;
  const tripMatch = { status: 'Completed', ...dateRange('completedAt', fromDate, toDate) };

  const [driverPerformance, safetyDistribution, licenseAlerts] = await Promise.all([
    // Per-driver completed trips, revenue, distance
    Trip.aggregate([
      { $match: tripMatch },
      {
        $group: {
          _id: '$driver',
          tripsCompleted: { $sum: 1 },
          totalRevenue: { $sum: '$revenue' },
          totalDistance: { $sum: '$computedDistance' },
          avgCargoWeight: { $avg: '$cargoWeight' },
        },
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driver',
        },
      },
      { $unwind: '$driver' },
      {
        $project: {
          driverName: '$driver.name',
          licenseNumber: '$driver.licenseNumber',
          safetyScore: '$driver.safetyScore',
          status: '$driver.status',
          licenseExpiry: '$driver.licenseExpiry',
          tripsCompleted: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalDistance: { $round: ['$totalDistance', 1] },
          avgCargoWeight: { $round: ['$avgCargoWeight', 1] },
          revenuePerTrip: {
            $round: [{ $cond: [{ $gt: ['$tripsCompleted', 0] }, { $divide: ['$totalRevenue', '$tripsCompleted'] }, 0] }, 2],
          },
        },
      },
      { $sort: { tripsCompleted: -1 } },
    ]),

    // Safety score distribution
    Driver.aggregate([
      {
        $bucket: {
          groupBy: '$safetyScore',
          boundaries: [0, 60, 70, 80, 90, 101],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            label: {
              $first: {
                $switch: {
                  branches: [
                    { case: { $lt: ['$safetyScore', 60] }, then: 'Critical (<60)' },
                    { case: { $lt: ['$safetyScore', 70] }, then: 'Poor (60-69)' },
                    { case: { $lt: ['$safetyScore', 80] }, then: 'Average (70-79)' },
                    { case: { $lt: ['$safetyScore', 90] }, then: 'Good (80-89)' },
                  ],
                  default: 'Excellent (90+)',
                },
              },
            },
          },
        },
      },
    ]),

    // Drivers with license expiring in 30 days
    Driver.find({
      licenseExpiryDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      status: { $ne: 'Suspended' },
    }).select('name licenseNumber licenseExpiryDate safetyScore status').lean(),
  ]);

  sendSuccess(res, 200, 'Driver statistics retrieved', {
    performance: driverPerformance,
    safetyDistribution,
    licenseAlerts: {
      count: licenseAlerts.length,
      drivers: licenseAlerts,
    },
  });
};

// ─────────────────────────────────────────────────
// GET /api/analytics/monthly-trend
// Rolling 12-month breakdown of revenue, costs, trips
// ─────────────────────────────────────────────────
const getMonthlyTrend = async (req, res) => {
  const months = parseInt(req.query.months) || 12;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [tripTrend, fuelTrend, expenseTrend] = await Promise.all([
    Trip.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          trips: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, '$revenue', 0] } },
          distance: { $sum: '$computedDistance' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          period: {
            $concat: [
              { $toString: '$_id.year' }, '-',
              { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
            ],
          },
          trips: 1, completed: 1,
          revenue: { $round: ['$revenue', 2] },
          distance: { $round: ['$distance', 1] },
        },
      },
    ]),

    FuelLog.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, fuelCost: { $sum: '$totalCost' }, liters: { $sum: '$liters' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          period: {
            $concat: [
              { $toString: '$_id.year' }, '-',
              { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
            ],
          },
          fuelCost: { $round: ['$fuelCost', 2] },
          liters: { $round: ['$liters', 1] },
        },
      },
    ]),

    Expense.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, expenseCost: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          period: {
            $concat: [
              { $toString: '$_id.year' }, '-',
              { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
            ],
          },
          expenseCost: { $round: ['$expenseCost', 2] },
        },
      },
    ]),
  ]);

  sendSuccess(res, 200, `Monthly trend (${months} months) retrieved`, {
    trips: tripTrend,
    fuel: fuelTrend,
    expenses: expenseTrend,
  });
};

module.exports = {
  getDashboard,
  getFleetUtilization,
  getTripPerformance,
  getCostBreakdown,
  getDriverStats,
  getMonthlyTrend,
};
