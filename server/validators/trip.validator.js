/**
 * TransitOps — Trip Request Validators
 */
const { body, query } = require('express-validator');
const { TRIP_STATUS } = require('../utils/constants');
const { validate } = require('./auth.validator');

const createTripRules = [
  body('source')
    .trim().notEmpty().withMessage('Source location is required')
    .isLength({ max: 150 }).withMessage('Source cannot exceed 150 characters'),

  body('destination')
    .trim().notEmpty().withMessage('Destination is required')
    .isLength({ max: 150 }).withMessage('Destination cannot exceed 150 characters')
    .custom((val, { req }) => {
      if (val.trim().toLowerCase() === req.body.source?.trim().toLowerCase()) {
        throw new Error('Source and destination cannot be the same');
      }
      return true;
    }),

  body('plannedDistance')
    .notEmpty().withMessage('Planned distance is required')
    .isFloat({ min: 1 }).withMessage('Planned distance must be at least 1 km')
    .toFloat(),

  body('cargoWeight')
    .notEmpty().withMessage('Cargo weight is required')
    .isFloat({ min: 0 }).withMessage('Cargo weight cannot be negative')
    .toFloat(),

  body('vehicle')
    .notEmpty().withMessage('Vehicle is required')
    .isMongoId().withMessage('Invalid vehicle ID'),

  body('driver')
    .notEmpty().withMessage('Driver is required')
    .isMongoId().withMessage('Invalid driver ID'),

  body('revenue')
    .optional()
    .isFloat({ min: 0 }).withMessage('Revenue cannot be negative')
    .toFloat(),

  body('cargoDescription').optional().trim().isLength({ max: 300 }),
  body('notes').optional().trim().isLength({ max: 500 }),
];

const dispatchTripRules = [
  body('startOdometer')
    .optional()
    .isFloat({ min: 0 }).withMessage('Start odometer cannot be negative')
    .toFloat(),
];

const completeTripRules = [
  body('endOdometer')
    .optional()
    .isFloat({ min: 0 }).withMessage('End odometer cannot be negative')
    .toFloat(),

  body('actualDistance')
    .optional()
    .isFloat({ min: 0 }).withMessage('Actual distance cannot be negative')
    .toFloat(),

  body('fuelConsumed')
    .optional()
    .isFloat({ min: 0 }).withMessage('Fuel consumed cannot be negative')
    .toFloat(),

  body('revenue')
    .optional()
    .isFloat({ min: 0 }).withMessage('Revenue cannot be negative')
    .toFloat(),
];

const cancelTripRules = [
  body('cancellationReason')
    .trim().notEmpty().withMessage('Cancellation reason is required')
    .isLength({ max: 300 }).withMessage('Reason cannot exceed 300 characters'),
];

const listTripRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(Object.values(TRIP_STATUS)).withMessage('Invalid status'),
  query('vehicle').optional().isMongoId().withMessage('Invalid vehicle ID'),
  query('driver').optional().isMongoId().withMessage('Invalid driver ID'),
  query('sortBy').optional().isIn(['source', 'destination', 'status', 'cargoWeight', 'revenue', 'createdAt', 'dispatchedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = {
  validate,
  createTripRules,
  dispatchTripRules,
  completeTripRules,
  cancelTripRules,
  listTripRules,
};
