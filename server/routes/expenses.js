/**
 * TransitOps — Expense Routes
 *
 * GET    /api/expenses           - List expenses (filter by vehicle/category/date/amount)
 * GET    /api/expenses/summary   - Aggregated summary (by category + by vehicle)
 * GET    /api/expenses/:id       - Single expense
 * POST   /api/expenses           - Log expense
 * PUT    /api/expenses/:id       - Update expense
 * DELETE /api/expenses/:id       - Delete expense
 */
const router = require('express').Router();
const {
  getExpenses, getExpenseById,
  createExpense, updateExpense, deleteExpense,
  getExpenseSummary,
} = require('../controllers/expense.controller');

const { protect, onlyFleetManager, fleetOrDriver } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');
const { validate, createExpenseRules, listExpenseRules } = require('../validators/fuelExpense.validator');

router.use(protect);

router.get('/', listExpenseRules, validate, cacheMiddleware(CACHE_TTLS.DEFAULT, 'expenses'), getExpenses);
router.get('/summary', cacheMiddleware(CACHE_TTLS.ANALYTICS, 'expense-summary'), getExpenseSummary);
router.get('/:id', cacheMiddleware(CACHE_TTLS.DEFAULT, 'expense-detail'), getExpenseById);

router.post('/', writeLimiter, fleetOrDriver, createExpenseRules, validate, createExpense);
router.put('/:id', writeLimiter, onlyFleetManager, createExpenseRules, validate, updateExpense);
router.delete('/:id', writeLimiter, onlyFleetManager, deleteExpense);

module.exports = router;
