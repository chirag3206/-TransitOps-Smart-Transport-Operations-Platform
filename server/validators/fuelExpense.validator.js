/**
 * TransitOps — FuelLog & Expense Request Validators
 */
const { body, query } = require('express-validator');
const { EXPENSE_CATEGORY } = require('../utils/constants');
const { validate } = require('./auth.validator');

// ── FuelLog validators ────────────────────────────────────────────────────────
const createFuelLogRules = [
  body('vehicle')
    .notEmpty().withMessage('Vehicle is required')
    .isMongoId().withMessage('Invalid vehicle ID'),

  body('liters')
    .notEmpty().withMessage('Fuel quantity is required')
    .isFloat({ min: 0.1, max: 5000 }).withMessage('Liters must be between 0.1 and 5000')
    .toFloat(),

  body('pricePerLiter')
    .notEmpty().withMessage('Price per liter is required')
    .isFloat({ min: 0 }).withMessage('Price cannot be negative')
    .toFloat(),

  body('totalCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Total cost cannot be negative')
    .toFloat(),

  body('date')
    .optional()
    .isISO8601().withMessage('Invalid date')
    .toDate(),

  body('trip').optional().isMongoId().withMessage('Invalid trip ID'),
  body('odometerReading').optional().isFloat({ min: 0 }).toFloat(),
  body('fuelType').optional().isIn(['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid']),
  body('location').optional().trim().isLength({ max: 150 }),
  body('notes').optional().trim().isLength({ max: 300 }),
];

const listFuelLogRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('vehicle').optional().isMongoId(),
  query('trip').optional().isMongoId(),
  query('sortBy').optional().isIn(['date', 'liters', 'totalCost', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

// ── Expense validators ────────────────────────────────────────────────────────
const createExpenseRules = [
  body('vehicle')
    .notEmpty().withMessage('Vehicle is required')
    .isMongoId().withMessage('Invalid vehicle ID'),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(Object.values(EXPENSE_CATEGORY))
    .withMessage(`Category must be one of: ${Object.values(EXPENSE_CATEGORY).join(', ')}`),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
    .toFloat(),

  body('description')
    .trim().notEmpty().withMessage('Description is required')
    .isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),

  body('date')
    .optional()
    .isISO8601().withMessage('Invalid date')
    .toDate(),

  body('trip').optional().isMongoId().withMessage('Invalid trip ID'),
  body('receiptNumber').optional().trim().isLength({ max: 50 }),
  body('location').optional().trim().isLength({ max: 150 }),
  body('notes').optional().trim().isLength({ max: 300 }),
];

const listExpenseRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('vehicle').optional().isMongoId(),
  query('trip').optional().isMongoId(),
  query('category').optional().isIn(Object.values(EXPENSE_CATEGORY)),
  query('sortBy').optional().isIn(['date', 'amount', 'category', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = {
  validate,
  createFuelLogRules, listFuelLogRules,
  createExpenseRules, listExpenseRules,
};
