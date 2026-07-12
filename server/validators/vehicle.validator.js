/**
 * TransitOps — Vehicle Request Validators
 * express-validator schemas for vehicle CRUD endpoints
 */
const { body, query, param } = require('express-validator');
const { VEHICLE_STATUS, VEHICLE_TYPE } = require('../utils/constants');

// ─────────────────────────────────────────────
// Shared: reusable validate runner (imported from auth.validator)
// ─────────────────────────────────────────────
const { validate } = require('./auth.validator');

// ─────────────────────────────────────────────
// Create vehicle rules
// ─────────────────────────────────────────────
const createVehicleRules = [
  body('registrationNumber')
    .trim().notEmpty().withMessage('Registration number is required')
    .isLength({ min: 3, max: 20 }).withMessage('Registration number must be 3-20 characters')
    .matches(/^[A-Z0-9\-]+$/i).withMessage('Only letters, numbers, and hyphens allowed'),

  body('name')
    .trim().notEmpty().withMessage('Vehicle name/model is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('type')
    .notEmpty().withMessage('Vehicle type is required')
    .isIn(Object.values(VEHICLE_TYPE)).withMessage(`Type must be one of: ${Object.values(VEHICLE_TYPE).join(', ')}`),

  body('maxLoadCapacity')
    .notEmpty().withMessage('Maximum load capacity is required')
    .isFloat({ min: 1, max: 100000 }).withMessage('Capacity must be between 1 and 100,000 kg')
    .toFloat(),

  body('acquisitionCost')
    .notEmpty().withMessage('Acquisition cost is required')
    .isFloat({ min: 0 }).withMessage('Acquisition cost cannot be negative')
    .toFloat(),

  body('odometer')
    .optional()
    .isFloat({ min: 0 }).withMessage('Odometer cannot be negative')
    .toFloat(),

  body('status')
    .optional()
    .isIn(Object.values(VEHICLE_STATUS)).withMessage(`Invalid status`),

  body('year')
    .optional()
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 }).withMessage('Invalid year')
    .toInt(),

  body('fuelType')
    .optional()
    .isIn(['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid']).withMessage('Invalid fuel type'),

  body('region').optional().trim().isLength({ max: 50 }).withMessage('Region too long'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long'),
];

// ─────────────────────────────────────────────
// Update vehicle rules (all optional)
// ─────────────────────────────────────────────
const updateVehicleRules = [
  body('registrationNumber')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Registration number must be 3-20 characters')
    .matches(/^[A-Z0-9\-]+$/i).withMessage('Only letters, numbers, and hyphens allowed'),

  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  body('type').optional().isIn(Object.values(VEHICLE_TYPE)).withMessage('Invalid vehicle type'),

  body('maxLoadCapacity')
    .optional()
    .isFloat({ min: 1, max: 100000 }).withMessage('Capacity must be between 1 and 100,000 kg')
    .toFloat(),

  body('acquisitionCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Acquisition cost cannot be negative')
    .toFloat(),

  body('odometer')
    .optional()
    .isFloat({ min: 0 }).withMessage('Odometer cannot be negative')
    .toFloat(),

  body('status')
    .optional()
    .isIn(Object.values(VEHICLE_STATUS)).withMessage('Invalid status'),

  body('year')
    .optional()
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 }).withMessage('Invalid year')
    .toInt(),

  body('fuelType')
    .optional()
    .isIn(['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid']).withMessage('Invalid fuel type'),

  body('region').optional().trim(),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long'),
];

// ─────────────────────────────────────────────
// Query list rules (search, filter, pagination)
// ─────────────────────────────────────────────
const listVehicleRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100').toInt(),
  query('status').optional().isIn(Object.values(VEHICLE_STATUS)).withMessage('Invalid status filter'),
  query('type').optional().isIn(Object.values(VEHICLE_TYPE)).withMessage('Invalid type filter'),
  query('sortBy').optional().isIn(['name', 'registrationNumber', 'status', 'type', 'odometer', 'acquisitionCost', 'createdAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
];

module.exports = {
  validate,
  createVehicleRules,
  updateVehicleRules,
  listVehicleRules,
};
