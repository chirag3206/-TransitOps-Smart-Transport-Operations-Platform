const router = require('express').Router();
// Fuel log routes — implemented in Task 10
router.get('/', (req, res) => res.json({ message: 'Fuel log routes coming in Task 10' }));
module.exports = router;
