const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// GET all alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ created_at: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a new alert
router.post('/', async (req, res) => {
  const { ticker, asset_type, target_price, condition, renotification_frequency_minutes } = req.body;
  if (!ticker || !asset_type || target_price == null || !condition) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const alert = new Alert({
    ticker,
    asset_type,
    target_price,
    condition,
    renotification_frequency_minutes: (condition === 'PRICE_STAYS_ABOVE' || condition === 'PRICE_STAYS_BELOW')
                                      ? (renotification_frequency_minutes || 0)
                                      : 0, 
    status: 'ACTIVE'
  });

  try {
    const newAlert = await alert.save();
    res.status(201).json(newAlert);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update an alert
router.put('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    const { target_price, condition, status, renotification_frequency_minutes } = req.body;

    if (target_price != null) alert.target_price = target_price;
    if (condition) alert.condition = condition;
    if (status) alert.status = status;
    if (renotification_frequency_minutes != null) {
        alert.renotification_frequency_minutes = (alert.condition === 'PRICE_STAYS_ABOVE' || alert.condition === 'PRICE_STAYS_BELOW')
                                                 ? renotification_frequency_minutes
                                                 : 0;
    }

    if (status === 'ACTIVE' && alert.status === 'MONITORING_STAY') {
        alert.last_triggered_timestamp = null; 
    }
     if (status === 'PAUSED' || status === 'ACTIVE') {
        if (alert.status !== 'TRIGGERED_ONCE' && (alert.condition === 'PRICE_STAYS_ABOVE' || alert.condition === 'PRICE_STAYS_BELOW')) {
            alert.last_triggered_timestamp = null;
        }
    }

    const updatedAlert = await alert.save();
    res.json(updatedAlert);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE an alert
router.delete('/:id', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
