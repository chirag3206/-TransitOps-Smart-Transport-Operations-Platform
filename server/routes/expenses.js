const router = require('express').Router();
// Expense routes — implemented in Task 10
router.get('/', (req, res) => res.json({ message: 'Expense routes coming in Task 10' }));
module.exports = router;
