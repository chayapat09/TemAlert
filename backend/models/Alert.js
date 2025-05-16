const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  ticker: { type: String, required: true },
  asset_type: { type: String, required: true }, // STOCK, CRYPTO, CURRENCY, DERIVED
  target_price: { type: Number, required: true },
  condition: {
    type: String,
    required: true,
    enum: ['PRICE_RISES_ABOVE', 'PRICE_FALLS_BELOW', 'PRICE_STAYS_ABOVE', 'PRICE_STAYS_BELOW'],
  },
  status: {
    type: String,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'TRIGGERED_ONCE', 'MONITORING_STAY', 'PAUSED', 'ERROR', 'ERROR_NO_WEBHOOK'],
  },
  renotification_frequency_minutes: { type: Number, default: 0 }, // 0 or null means notify once for STAYS
  last_checked_price: { type: Number },
  last_checked_timestamp: { type: Date },
  created_at: { type: Date, default: Date.now },
  last_triggered_timestamp: { type: Date },
  initial_trigger_timestamp: { type: Date },
});

AlertSchema.index({ status: 1 });
AlertSchema.index({ ticker: 1, asset_type: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
