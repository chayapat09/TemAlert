const express = require('express');
const router = express.Router();
const AppSettings = require('../models/AppSettings');

const WEBHOOK_KEY = 'discord_webhook_url';

// GET Discord Webhook URL
router.get('/discord-webhook', async (req, res) => {
  try {
    let setting = await AppSettings.findOne({ setting_key: WEBHOOK_KEY });
    if (!setting && process.env.DISCORD_WEBHOOK_URL_GLOBAL_DEFAULT) {
        setting = { setting_key: WEBHOOK_KEY, setting_value: process.env.DISCORD_WEBHOOK_URL_GLOBAL_DEFAULT };
    }
    res.json({ webhook_url: setting ? setting.setting_value : null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT (Set/Update) Discord Webhook URL
router.put('/discord-webhook', async (req, res) => {
  const { webhook_url } = req.body;
  try {
    if (webhook_url && (!webhook_url.startsWith('http://') && !webhook_url.startsWith('https://'))) {
        return res.status(400).json({ message: "Invalid webhook URL format." });
    }

    const updatedSetting = await AppSettings.findOneAndUpdate(
      { setting_key: WEBHOOK_KEY },
      { setting_value: webhook_url || null }, 
      { new: true, upsert: true } 
    );
    res.json({ webhook_url: updatedSetting.setting_value });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
