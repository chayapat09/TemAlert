const mongoose = require('mongoose');

const AppSettingsSchema = new mongoose.Schema({
  setting_key: { type: String, required: true, unique: true }, // e.g., "discord_webhook_url"
  setting_value: { type: String },
});

module.exports = mongoose.model('AppSettings', AppSettingsSchema);
