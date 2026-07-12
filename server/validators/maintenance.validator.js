/**
 * TransitOps — Maintenance Request Validators
 */
const { body, query } = require('express-validator');
const { MAINTENANCE_STATUS, MAINTENANCE_TYPE } = require('../utils/constants');
const { validate } = require('./auth.validator');

const createMaintenanceRules = [
  body('vehicle')
    .notEmpty().withMessage('Vehicle is required')
    .isMongoId().withMessage('Invalid vehicle ID'),

  body('type')
    .notEmpty().withMessage('Maintenance type is required')
    .isIn(Object.values(MAINTENANCE_TYPE))
    .withMessage(`Type must be one of: ${Object.values(MAINTENANCE_TYPE).join(', ')}`),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('estimatedCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Estimated cost cannot be negative')
    .toFloat(),

  body('workshopName')
    .optional().trim().isLength({ max: 100 }).withMessage('Workshop name too long'),

  body('odometerReading')
    .optional()
    .isFloat({ min: 0 }).withMessage('Odometer cannot be negative')
    .toFloat(),

  body('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date')
    .toDate(),

  body('notes').optional().trim().isLength({ max: 500 }),
];

const closeMaintenanceRules = [
  body('actualCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Actual cost cannot be negative')
    .toFloat(),

  body('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date')
    .toDate(),

  body('notes').optional().trim().isLength({ max: 500 }),
];

const updateMaintenanceRules = [
  body('type').optional().isIn(Object.values(MAINTENANCE_TYPE)).withMessage('Invalid type'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('estimatedCost').optional().isFloat({ min: 0 }).toFloat(),
  body('actualCost').optional().isFloat({ min: 0 }).toFloat(),
  body('workshopName').optional().trim().isLength({ max: 100 }),
  body('odometerReading').optional().isFloat({ min: 0 }).toFloat(),
  body('notes').optional().trim().isLength({ max: 500 }),
];

const listMaintenanceRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('vehicle').optional().isMongoId(),
  query('status').optional().isIn(Object.values(MAINTENANCE_STATUS)),
  query('type').optional().isIn(Object.values(MAINTENANCE_TYPE)),
  query('sortBy').optional().isIn(['startDate', 'endDate', 'actualCost', 'estimatedCost', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = { validate, createMaintenanceRules, closeMaintenanceRules, updateMaintenanceRules, listMaintenanceRules };
