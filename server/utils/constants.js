/**
 * TransitOps — Constants
 * Shared constants used across the application
 */

// Vehicle statuses
const VEHICLE_STATUS = {
  AVAILABLE: 'Available',
  ON_TRIP: 'On Trip',
  PENDING_MAINTENANCE: 'Pending Maintenance',
  IN_SHOP: 'In Shop',
  RETIRED: 'Retired',
};

// Statuses that block vehicle from dispatch
const VEHICLE_BLOCKED_STATUSES = [
  VEHICLE_STATUS.ON_TRIP,
  VEHICLE_STATUS.PENDING_MAINTENANCE,
  VEHICLE_STATUS.IN_SHOP,
  VEHICLE_STATUS.RETIRED,
];

// Vehicle types
const VEHICLE_TYPE = {
  TRUCK: 'Truck',
  VAN: 'Van',
  PICKUP: 'Pickup',
  FLATBED: 'Flatbed',
  TANKER: 'Tanker',
  REFRIGERATED: 'Refrigerated',
  BUS: 'Bus',
  MOTORCYCLE: 'Motorcycle',
};

// Driver statuses
const DRIVER_STATUS = {
  AVAILABLE: 'Available',
  ON_TRIP: 'On Trip',
  OFF_DUTY: 'Off Duty',
  SUSPENDED: 'Suspended',
};

// Statuses that block driver from dispatch
const DRIVER_BLOCKED_STATUSES = [
  DRIVER_STATUS.ON_TRIP,
  DRIVER_STATUS.SUSPENDED,
  DRIVER_STATUS.OFF_DUTY,
];

// License categories
const LICENSE_CATEGORY = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  LMV: 'LMV',
  HMV: 'HMV',
};

// Trip statuses (lifecycle)
const TRIP_STATUS = {
  DRAFT: 'Draft',
  DISPATCHED: 'Dispatched',
  IN_PROGRESS: 'In Progress',
  PENDING_COMPLETION: 'Pending Completion',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// Maintenance statuses
const MAINTENANCE_STATUS = {
  PENDING_APPROVAL: 'Pending Approval',
  IN_WORKSHOP: 'In Workshop',
  CLOSED: 'Closed',
};

// Maintenance types
const MAINTENANCE_TYPE = {
  OIL_CHANGE: 'Oil Change',
  TIRE_REPLACEMENT: 'Tire Replacement',
  BRAKE_SERVICE: 'Brake Service',
  ENGINE_REPAIR: 'Engine Repair',
  TRANSMISSION: 'Transmission Service',
  BATTERY: 'Battery Replacement',
  ELECTRICAL: 'Electrical Repair',
  BODY_REPAIR: 'Body Repair',
  INSPECTION: 'Annual Inspection',
  OTHER: 'Other',
};

// Expense categories
const EXPENSE_CATEGORY = {
  TOLL: 'Toll',
  FUEL: 'Fuel',
  MAINTENANCE: 'Maintenance',
  PARKING: 'Parking',
  FINE: 'Fine',
  INSURANCE: 'Insurance',
  REGISTRATION: 'Registration',
  OTHER: 'Other',
};

// User roles
const USER_ROLE = {
  FLEET_MANAGER: 'fleet_manager',
  DRIVER: 'driver',
  SAFETY_OFFICER: 'safety_officer',
  FINANCIAL_ANALYST: 'financial_analyst',
};

// License expiry warning threshold (days)
const LICENSE_EXPIRY_WARNING_DAYS = 30;

// Regions (for dashboard filters)
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];

module.exports = {
  VEHICLE_STATUS,
  VEHICLE_BLOCKED_STATUSES,
  VEHICLE_TYPE,
  DRIVER_STATUS,
  DRIVER_BLOCKED_STATUSES,
  LICENSE_CATEGORY,
  TRIP_STATUS,
  MAINTENANCE_STATUS,
  MAINTENANCE_TYPE,
  EXPENSE_CATEGORY,
  USER_ROLE,
  LICENSE_EXPIRY_WARNING_DAYS,
  REGIONS,
};
