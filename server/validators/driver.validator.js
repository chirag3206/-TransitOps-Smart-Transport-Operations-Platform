/**
 * TransitOps — Driver Request Validators
 */
const { body, query } = require('express-validator');
const { DRIVER_STATUS, LICENSE_CATEGORY } = require('../utils/constants');
const { validate } = require('./auth.validator');

const createDriverRules = [
  body('name')
    .trim().notEmpty().withMessage('Driver name is required')
    .isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),

  body('contactNumber')
    .trim().notEmpty().withMessage('Contact number is required')
    .matches(/^[+\d\s\-()]{7,20}$/).withMessage('Invalid contact number format'),

  body('email')
    .optional({ nullable: true })
    .trim().isEmail().withMessage('Invalid email address')
    .normalizeEmail(),

  body('licenseNumber')
    .trim().notEmpty().withMessage('License number is required')
    .isLength({ min: 4, max: 30 }).withMessage('License number must be 4-30 characters'),

  body('licenseCategory')
    .notEmpty().withMessage('License category is required')
    .isIn(Object.values(LICENSE_CATEGORY))
    .withMessage(`Category must be one of: ${Object.values(LICENSE_CATEGORY).join(', ')}`),

  body('licenseExpiryDate')
    .notEmpty().withMessage('License expiry date is required')
    .isISO8601().withMessage('Invalid date format. Use ISO 8601 (YYYY-MM-DD)')
    .toDate(),

  body('status')
    .optional()
    .isIn(Object.values(DRIVER_STATUS)).withMessage('Invalid driver status'),

  body('safetyScore')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Safety score must be 0-100')
    .toFloat(),

  body('region').optional().trim().isLength({ max: 50 }).withMessage('Region too long'),
  body('address').optional().trim().isLength({ max: 200 }).withMessage('Address too long'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long'),

  body('joiningDate')
    .optional()
    .isISO8601().withMessage('Invalid joining date')
    .toDate(),
];

const updateDriverRules = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  body('contactNumber').optional().trim().matches(/^[+\d\s\-()]{7,20}$/).withMessage('Invalid contact number'),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('licenseNumber').optional().trim().isLength({ min: 4, max: 30 }).withMessage('License number must be 4-30 characters'),
  body('licenseCategory').optional().isIn(Object.values(LICENSE_CATEGORY)).withMessage('Invalid license category'),
  body('licenseExpiryDate').optional().isISO8601().withMessage('Invalid date format').toDate(),
  body('status').optional().isIn(Object.values(DRIVER_STATUS)).withMessage('Invalid status'),
  body('safetyScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Safety score must be 0-100').toFloat(),
  body('region').optional().trim(),
  body('address').optional().trim().isLength({ max: 200 }).withMessage('Address too long'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long'),
];

const listDriverRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(Object.values(DRIVER_STATUS)).withMessage('Invalid status'),
  query('licenseCategory').optional().isIn(Object.values(LICENSE_CATEGORY)).withMessage('Invalid category'),
  query('licenseStatus').optional().isIn(['valid', 'expiring_soon', 'expired']).withMessage('Invalid licenseStatus filter'),
  query('sortBy').optional().isIn(['name', 'status', 'licenseExpiryDate', 'safetyScore', 'totalTrips', 'createdAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = { validate, createDriverRules, updateDriverRules, listDriverRules };
