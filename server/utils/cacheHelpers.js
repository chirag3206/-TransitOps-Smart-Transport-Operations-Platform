/**
 * TransitOps — Cache Admin Utilities
 * Helper functions consumed by controllers to invalidate cache on mutations
 *
 * Usage in a controller:
 *   const { bustCache } = require('../utils/cacheHelpers');
 *   await bustCache.vehicles();   // after create/update/delete vehicle
 *   await bustCache.trips();      // after dispatch/complete/cancel trip
 */
const { invalidateByPrefix, flushAll } = require('../middleware/cache');

const bustCache = {
  vehicles: () => invalidateByPrefix('/api/vehicles'),
  drivers: () => invalidateByPrefix('/api/drivers'),
  trips: () => {
    invalidateByPrefix('/api/trips');
    invalidateByPrefix('/api/analytics'); // trips affect dashboard KPIs
  },
  maintenance: () => {
    invalidateByPrefix('/api/maintenance');
    invalidateByPrefix('/api/vehicles');  // maintenance changes vehicle status
    invalidateByPrefix('/api/analytics');
  },
  fuelLogs: () => {
    invalidateByPrefix('/api/fuel-logs');
    invalidateByPrefix('/api/analytics'); // fuel affects operational cost
  },
  expenses: () => {
    invalidateByPrefix('/api/expenses');
    invalidateByPrefix('/api/analytics');
  },
  analytics: () => invalidateByPrefix('/api/analytics'),
  all: () => flushAll(),
};

module.exports = { bustCache };
