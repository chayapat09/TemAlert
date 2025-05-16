const Alert = require('../models/Alert');
const AppSettings = require('../models/AppSettings');
const { sendDiscordNotification } = require('../utils/discordHelper');
const axios = require('axios');
require('dotenv').config();

const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE_URL;

const fetchLatestPrice = async (ticker, assetType) => {
  if (!EXTERNAL_API_BASE) {
    console.error("EXTERNAL_API_BASE_URL is not configured in .env");
    return { error: "API endpoint not configured" };
  }
  try {
    const response = await axios.get(`${EXTERNAL_API_BASE}/api/latest`, { // Corrected to use /api/latest path
      params: { ticker, asset_type: assetType },
    });
    return response.data; // { ticker, asset_type, price, timestamp, (formula) }
  } catch (error) {
    console.error(`Error fetching price for ${ticker} (${assetType}) from ${EXTERNAL_API_BASE}/api/latest:`, 
                  error.response ? JSON.stringify(error.response.data) : error.message);
    if (error.response) {
        // Pass through error from external API if available
        return { error: error.response.data.error || "API error", status: error.response.status };
    }
    return { error: "Network error or API unavailable" };
  }
};

const checkAlerts = async () => {
  console.log('Checking alerts...');
  const webhookSetting = await AppSettings.findOne({ setting_key: 'discord_webhook_url' });
  const globalWebhookUrl = webhookSetting ? webhookSetting.setting_value : process.env.DISCORD_WEBHOOK_URL_GLOBAL_DEFAULT;

  const activeAlerts = await Alert.find({
    status: { $in: ['ACTIVE', 'MONITORING_STAY'] },
  });

  if (activeAlerts.length === 0) {
    console.log('No active alerts to check.');
    return;
  }

  const uniqueTickers = {};
  activeAlerts.forEach(alert => {
    const key = `${alert.ticker}-${alert.asset_type}`;
    if (!uniqueTickers[key]) {
      uniqueTickers[key] = { ticker: alert.ticker, asset_type: alert.asset_type, priceData: null };
    }
  });

  for (const key in uniqueTickers) {
    const item = uniqueTickers[key];
    const priceData = await fetchLatestPrice(item.ticker, item.asset_type);
    if (priceData && !priceData.error) {
        item.priceData = priceData;
    } else {
        activeAlerts.forEach(async alert => {
            if(alert.ticker === item.ticker && alert.asset_type === item.asset_type && alert.status !== 'ERROR') {
                alert.status = 'ERROR';
                alert.last_checked_timestamp = new Date();
                alert.last_checked_price = null; // Clear price on error
                console.log(`Marking alert ${alert._id} for ${alert.ticker} as ERROR. Reason: ${priceData ? priceData.error : 'Unknown API error'}`);
                await alert.save();
            }
        });
    }
  }

  for (const alert of activeAlerts) {
    // Refresh alert data in case it was marked as ERROR above
    const currentAlertState = await Alert.findById(alert._id);
    if (!currentAlertState || currentAlertState.status === 'ERROR' || currentAlertState.status === 'PAUSED') {
        continue; // Skip if it was just marked as error or is paused
    }

    const tickerKey = `${alert.ticker}-${alert.asset_type}`;
    const priceInfo = uniqueTickers[tickerKey] ? uniqueTickers[tickerKey].priceData : null;

    if (!priceInfo || priceInfo.error) {
      // This check is somewhat redundant if error handling above is robust, but good for safety
      console.log(`Skipping alert ${alert._id} for ${alert.ticker} due to no price data or API error during processing loop.`);
      if(alert.status !== 'ERROR') {
        alert.status = 'ERROR';
        alert.last_checked_timestamp = new Date();
        await alert.save();
      }
      continue;
    }

    const currentPrice = priceInfo.price;
    const now = new Date();
    alert.last_checked_price = currentPrice;
    alert.last_checked_timestamp = now;

    let conditionMet = false;
    let sendNotification = false;

    switch (alert.condition) {
      case 'PRICE_RISES_ABOVE':
        if (alert.status === 'ACTIVE' && currentPrice > alert.target_price) {
          conditionMet = true;
          sendNotification = true;
          alert.status = 'TRIGGERED_ONCE';
        }
        break;
      case 'PRICE_FALLS_BELOW':
        if (alert.status === 'ACTIVE' && currentPrice < alert.target_price) {
          conditionMet = true;
          sendNotification = true;
          alert.status = 'TRIGGERED_ONCE';
        }
        break;
      case 'PRICE_STAYS_ABOVE':
        if (currentPrice > alert.target_price) {
          conditionMet = true;
          if (alert.status === 'ACTIVE') {
            sendNotification = true;
            alert.status = 'MONITORING_STAY';
          } else if (alert.status === 'MONITORING_STAY') {
            if (alert.renotification_frequency_minutes && alert.renotification_frequency_minutes > 0) {
              const diffMinutes = (now.getTime() - (alert.last_triggered_timestamp || 0).getTime()) / (1000 * 60);
              if (!alert.last_triggered_timestamp || diffMinutes >= alert.renotification_frequency_minutes) {
                sendNotification = true;
              }
            }
          }
        } else { 
          if (alert.status === 'MONITORING_STAY') {
            alert.status = 'ACTIVE'; 
          }
        }
        break;
      case 'PRICE_STAYS_BELOW':
        if (currentPrice < alert.target_price) {
          conditionMet = true;
          if (alert.status === 'ACTIVE') {
            sendNotification = true;
            alert.status = 'MONITORING_STAY';
          } else if (alert.status === 'MONITORING_STAY') {
            if (alert.renotification_frequency_minutes && alert.renotification_frequency_minutes > 0) {
              const diffMinutes = (now.getTime() - (alert.last_triggered_timestamp || 0).getTime()) / (1000 * 60);
              if (!alert.last_triggered_timestamp || diffMinutes >= alert.renotification_frequency_minutes) {
                sendNotification = true;
              }
            }
          }
        } else { 
          if (alert.status === 'MONITORING_STAY') {
            alert.status = 'ACTIVE'; 
          }
        }
        break;
    }

    if (sendNotification) {
      if (!globalWebhookUrl) {
        console.warn(`Alert ${alert._id} triggered but no global Discord Webhook URL is set.`);
        alert.status = 'ERROR_NO_WEBHOOK';
      } else {
        const notificationResult = await sendDiscordNotification(alert, currentPrice);
        if (notificationResult.success) {
          if (!alert.initial_trigger_timestamp && (alert.status === 'TRIGGERED_ONCE' || alert.status === 'MONITORING_STAY')) {
            alert.initial_trigger_timestamp = now;
          }
          alert.last_triggered_timestamp = now;
        } else if (notificationResult.error === 'NO_WEBHOOK_URL') {
            alert.status = 'ERROR_NO_WEBHOOK';
        } 
      }
    }
    await alert.save();
  }
  console.log('Finished checking alerts.');
};

module.exports = { checkAlerts, fetchLatestPrice };
