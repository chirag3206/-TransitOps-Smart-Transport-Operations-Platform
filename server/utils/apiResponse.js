/**
 * TransitOps — API Response Helpers
 * Consistent success/error response formatting
 */

/**
 * Send a success response
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {any} data - Response payload
 * @param {object} meta - Pagination or extra metadata
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const response = {
    success: true,
    message,
  };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

/**
 * Send a paginated list response
 * @param {Response} res - Express response object
 * @param {Array} data - Array of items
 * @param {number} total - Total count (before pagination)
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {string} message - Optional message
 */
const sendPaginated = (res, data, total, page, limit, message = 'Retrieved successfully') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
};

/**
 * Parse pagination params from query string
 * @param {object} query - Express query object
 * @returns {{ page, limit, skip }}
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Parse sort params from query string
 * @param {object} query - Express query object  
 * @param {string[]} allowedFields - Fields allowed for sorting
 * @returns {object} Mongoose sort object
 */
const parseSort = (query, allowedFields = []) => {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const field = allowedFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder === 'asc' ? 1 : -1;
  return { [field]: order };
};

/**
 * Async wrapper to avoid try/catch boilerplate
 * Works with express-async-errors package already installed
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  sendSuccess,
  sendPaginated,
  parsePagination,
  parseSort,
  asyncHandler,
};
