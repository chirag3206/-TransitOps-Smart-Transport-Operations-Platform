const router = require('express').Router();
// Analytics routes — implemented in Task 11
router.get('/dashboard', (req, res) => res.json({ message: 'Analytics routes coming in Task 11' }));
router.get('/reports', (req, res) => res.json({ message: 'Reports routes coming in Task 11' }));
module.exports = router;
