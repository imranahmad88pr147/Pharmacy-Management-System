const express = require('express');
const router = express.Router();

// Sample data - replace this with actual database queries
let vendors = [
  { id: 1, name: 'Vendor 1' },
  { id: 2, name: 'Vendor 2' },
];

// GET all vendors
router.get('/', (req, res) => {
  res.json(vendors);
});

// POST new vendor
router.post('/', (req, res) => {
  const { name } = req.body;
  const newVendor = { id: vendors.length + 1, name }; // Simulating auto-increment ID
  vendors.push(newVendor);
  res.status(201).json(newVendor);
});

module.exports = router;
