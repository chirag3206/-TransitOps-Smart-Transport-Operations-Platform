const router = require('express').Router();
// Maintenance routes — implemented in Task 9
router.get('/', (req, res) => res.json({ message: 'Maintenance routes coming in Task 9' }));
module.exports = router;
