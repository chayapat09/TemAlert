const Alert = require('../models/Alert');
const AppSettings = require('../models/AppSettings');
const { sendDiscordNotification } = require('../utils/discordHelper');
const axios = require('axios');
require('dotenv').config();

const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE_URL;

// fetchLatestPrice function remains the same as in your original post
const fetchLatestPrice = async (ticker, assetType) => {
  if (!EXTERNAL_API_BASE) {
    console.error("EXTERNAL_API_BASE_URL is not configured in .env");
    return { error: "API endpoint not configured" };
  }
  try {
    const response = await axios.get(`${EXTERNAL_API_BASE}/api/latest`, {
      params: { ticker, asset_type: assetType },
    });
    // console.log(`[fetchLatestPrice] Successfully fetched price for ${ticker} (${assetType}): ${response.data.price}`);
    return response.data;
  } catch (error) {
    console.error(`[fetchLatestPrice] Error fetching price for ${ticker} (${assetType}) from ${EXTERNAL_API_BASE}/api/latest:`,
                  error.response ? JSON.stringify(error.response.data) : error.message);
    if (error.response) {
        return { error: error.response.data.error || "API error", status: error.response.status };
    }
    return { error: "Network error or API unavailable" };
  }
};


const checkAlerts = async () => {
  console.log('-----------------------------------------------------');
  console.log(`[${new Date().toISOString()}] Starting alert check process...`);

  const webhookSetting = await AppSettings.findOne({ setting_key: 'discord_webhook_url' });
  const globalWebhookUrl = webhookSetting ? webhookSetting.setting_value : process.env.DISCORD_WEBHOOK_URL_GLOBAL_DEFAULT;
  if (!globalWebhookUrl) {
    console.warn('[checkAlerts] WARNING: No global Discord Webhook URL is configured (neither in AppSettings nor .env default). Notifications might fail.');
  }

  // Fetch alerts including those in 'ERROR' state for potential recovery
  const alertsToPotentiallyProcess = await Alert.find({
    status: { $in: ['ACTIVE', 'MONITORING_STAY', 'ERROR'] }, // Include ERROR
  });

  console.log(`[checkAlerts] Found ${alertsToPotentiallyProcess.length} alerts with status ACTIVE, MONITORING_STAY, or ERROR.`);

  if (alertsToPotentiallyProcess.length === 0) {
    console.log('[checkAlerts] No alerts to check (including those in error state). Exiting.');
    console.log('-----------------------------------------------------');
    return;
  }

  // 1. Aggregate unique tickers and fetch prices
  const uniqueTickers = {};
  alertsToPotentiallyProcess.forEach(alert => {
    const key = `${alert.ticker}-${alert.asset_type}`;
    if (!uniqueTickers[key]) {
      uniqueTickers[key] = { ticker: alert.ticker, asset_type: alert.asset_type, priceData: null };
    }
  });

  console.log(`[checkAlerts] Processing ${Object.keys(uniqueTickers).length} unique ticker-asset_type combinations for price fetching.`);

  for (const key in uniqueTickers) {
    const item = uniqueTickers[key];
    console.log(`[checkAlerts] Attempting to fetch price for ${item.ticker} (${item.asset_type})...`);
    const priceData = await fetchLatestPrice(item.ticker, item.asset_type);

    if (priceData && !priceData.error) {
      console.log(`[checkAlerts] Successfully fetched price for ${item.ticker} (${item.asset_type}): ${priceData.price}`);
      item.priceData = priceData; // Store successful price data

      // Now, check if any alerts for this ticker were in ERROR state and try to recover them
      for (const alert of alertsToPotentiallyProcess) {
        if (alert.ticker === item.ticker && alert.asset_type === item.asset_type) {
          if (alert.status === 'ERROR') {
            console.log(`[checkAlerts] Alert ${alert._id} (${alert.ticker}/${alert.asset_type}) was in ERROR. Price fetch successful. Attempting to recover to ACTIVE.`);
            alert.status = 'ACTIVE'; // Recover to ACTIVE
            alert.last_checked_timestamp = new Date();
            alert.last_checked_price = priceData.price; // Update with current price
            // Optionally, you might want to clear/reset error-specific fields if you add them later
            try {
              await alert.save();
              console.log(`[checkAlerts] Alert ${alert._id} successfully recovered and saved with status ACTIVE.`);
            } catch (saveError) {
              console.error(`[checkAlerts] Error saving recovered alert ${alert._id}:`, saveError);
            }
          }
        }
      }
    } else {
      const errorReason = priceData ? priceData.error : 'Unknown API error during fetch';
      console.warn(`[checkAlerts] Failed to fetch price for ${item.ticker} (${item.asset_type}). Reason: ${errorReason}`);
      item.priceData = { error: errorReason }; // Store error info

      // Mark relevant active/monitoring alerts as ERROR or update timestamp for already errored ones
      for (const alert of alertsToPotentiallyProcess) {
        if (alert.ticker === item.ticker && alert.asset_type === item.asset_type) {
          if (alert.status !== 'ERROR') {
            console.log(`[checkAlerts] Alert ${alert._id} (${alert.ticker}/${alert.asset_type}) status ${alert.status}. Price fetch failed. Marking as ERROR.`);
            alert.status = 'ERROR';
            alert.last_checked_timestamp = new Date();
            alert.last_checked_price = null; // Clear price on error
            try {
              await alert.save();
              console.log(`[checkAlerts] Alert ${alert._id} successfully marked as ERROR and saved.`);
            } catch (saveError) {
              console.error(`[checkAlerts] Error saving alert ${alert._id} after marking as ERROR:`, saveError);
            }
          } else {
            // Already in ERROR, just update its last_checked_timestamp
            console.log(`[checkAlerts] Alert ${alert._id} (${alert.ticker}/${alert.asset_type}) already in ERROR. Updating last_checked_timestamp due to fetch failure.`);
            alert.last_checked_timestamp = new Date();
             try {
              await alert.save();
              console.log(`[checkAlerts] Alert ${alert._id} (already ERROR) last_checked_timestamp updated.`);
            } catch (saveError) {
              console.error(`[checkAlerts] Error saving alert ${alert._id} (already ERROR) timestamp update:`, saveError);
            }
          }
        }
      }
    }
  }

  console.log('[checkAlerts] Finished price fetching and initial status updates phase.');
  console.log('[checkAlerts] Starting individual alert condition processing loop...');

  // 2. Process individual alerts based on their (potentially updated) status
  for (const initialAlertData of alertsToPotentiallyProcess) {
    // CRITICAL: Re-fetch the alert from DB to get the absolute latest state,
    // as it might have been changed (e.g. ERROR -> ACTIVE) in the loop above.
    const alert = await Alert.findById(initialAlertData._id);

    if (!alert) {
        console.log(`[checkAlerts] Alert ${initialAlertData._id} no longer found in DB. Skipping.`);
        continue;
    }

    console.log(`[checkAlerts] Processing alert ${alert._id} (${alert.ticker}/${alert.asset_type}), Current Status: ${alert.status}`);

    // Skip if it's PAUSED or ended up (or remained) in ERROR after price fetching
    if (alert.status === 'PAUSED') {
        console.log(`[checkAlerts] Alert ${alert._id} is PAUSED. Skipping condition check.`);
        // Update last_checked_timestamp even for paused alerts if we want to track when they were last "seen" by the checker
        // alert.last_checked_timestamp = new Date(); // Optional: uncomment if needed
        // await alert.save();
        continue;
    }
    if (alert.status === 'ERROR') {
        console.log(`[checkAlerts] Alert ${alert._id} is in ERROR state (either pre-existing or due to recent fetch failure). Skipping condition check.`);
        continue;
    }
     if (alert.status === 'ERROR_NO_WEBHOOK') {
        console.log(`[checkAlerts] Alert ${alert._id} is in ERROR_NO_WEBHOOK state. Skipping condition check. Please configure webhook.`);
        // Potentially, you could try to re-evaluate if webhook is now available, but for now, we skip.
        continue;
    }


    const tickerKey = `${alert.ticker}-${alert.asset_type}`;
    const priceInfo = uniqueTickers[tickerKey] ? uniqueTickers[tickerKey].priceData : null;

    if (!priceInfo || priceInfo.error) {
      // This should ideally not be hit often if the error handling above is robust and marked alerts as ERROR.
      // However, it's a safeguard.
      console.warn(`[checkAlerts] Alert ${alert._id} (${alert.ticker}): No price data available or API error for this ticker in the uniqueTickers map. This is unexpected if the alert is not in ERROR state. Skipping condition check.`);
      // If it reached here and status is not ERROR, it's a potential logic issue or race condition.
      // For safety, we could mark it as ERROR here too, but the earlier loop should have caught it.
      if (alert.status !== 'ERROR') { // Double check
          alert.status = 'ERROR';
          alert.last_checked_timestamp = new Date();
          alert.last_checked_price = null;
          console.log(`[checkAlerts] Safeguard: Marking alert ${alert._id} as ERROR due to missing priceInfo for a non-ERROR alert.`);
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
    const originalStatus = alert.status; // For logging changes

    console.log(`[checkAlerts] Alert ${alert._id} (${alert.ticker}): Current Price: ${currentPrice}, Target: ${alert.target_price}, Condition: ${alert.condition}, Status: ${alert.status}`);

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
          conditionMet = true; // Condition is met as long as price is above
          if (alert.status === 'ACTIVE') {
            sendNotification = true; // First time meeting condition after being ACTIVE
            alert.status = 'MONITORING_STAY';
          } else if (alert.status === 'MONITORING_STAY') {
            // Already monitoring, check re-notification frequency
            if (alert.renotification_frequency_minutes && alert.renotification_frequency_minutes > 0) {
              const lastTriggered = alert.last_triggered_timestamp || 0; // Handle null last_triggered_timestamp
              const diffMinutes = (now.getTime() - new Date(lastTriggered).getTime()) / (1000 * 60);
              if (!alert.last_triggered_timestamp || diffMinutes >= alert.renotification_frequency_minutes) {
                sendNotification = true;
                console.log(`[checkAlerts] Alert ${alert._id}: Re-notification condition met for PRICE_STAYS_ABOVE. Diff minutes: ${diffMinutes.toFixed(2)}`);
              } else {
                 console.log(`[checkAlerts] Alert ${alert._id}: PRICE_STAYS_ABOVE condition met, but re-notification interval (${alert.renotification_frequency_minutes} min) not yet passed. Last triggered: ${diffMinutes.toFixed(2)} min ago.`);
              }
            } else {
                // No re-notification frequency set, so don't send again if already MONITORING_STAY
                console.log(`[checkAlerts] Alert ${alert._id}: PRICE_STAYS_ABOVE condition met, status MONITORING_STAY, but no re-notification frequency set. No new notification.`);
            }
          }
        } else { // Price is NOT above target
          if (alert.status === 'MONITORING_STAY') {
            console.log(`[checkAlerts] Alert ${alert._id}: Price (${currentPrice}) no longer above target (${alert.target_price}) for PRICE_STAYS_ABOVE. Resetting status from MONITORING_STAY to ACTIVE.`);
            alert.status = 'ACTIVE'; // Reset to ACTIVE if condition no longer met
          }
        }
        break;
      case 'PRICE_STAYS_BELOW':
        if (currentPrice < alert.target_price) {
          conditionMet = true; // Condition is met
          if (alert.status === 'ACTIVE') {
            sendNotification = true; // First time
            alert.status = 'MONITORING_STAY';
          } else if (alert.status === 'MONITORING_STAY') {
            if (alert.renotification_frequency_minutes && alert.renotification_frequency_minutes > 0) {
              const lastTriggered = alert.last_triggered_timestamp || 0;
              const diffMinutes = (now.getTime() - new Date(lastTriggered).getTime()) / (1000 * 60);
              if (!alert.last_triggered_timestamp || diffMinutes >= alert.renotification_frequency_minutes) {
                sendNotification = true;
                console.log(`[checkAlerts] Alert ${alert._id}: Re-notification condition met for PRICE_STAYS_BELOW. Diff minutes: ${diffMinutes.toFixed(2)}`);
              } else {
                console.log(`[checkAlerts] Alert ${alert._id}: PRICE_STAYS_BELOW condition met, but re-notification interval (${alert.renotification_frequency_minutes} min) not yet passed. Last triggered: ${diffMinutes.toFixed(2)} min ago.`);
              }
            } else {
                console.log(`[checkAlerts] Alert ${alert._id}: PRICE_STAYS_BELOW condition met, status MONITORING_STAY, but no re-notification frequency set. No new notification.`);
            }
          }
        } else { // Price is NOT below target
          if (alert.status === 'MONITORING_STAY') {
            console.log(`[checkAlerts] Alert ${alert._id}: Price (${currentPrice}) no longer below target (${alert.target_price}) for PRICE_STAYS_BELOW. Resetting status from MONITORING_STAY to ACTIVE.`);
            alert.status = 'ACTIVE'; // Reset
          }
        }
        break;
    }

    if (conditionMet) {
        console.log(`[checkAlerts] Alert ${alert._id}: Condition MET. Initial status: ${originalStatus}, New status: ${alert.status}. Send notification: ${sendNotification}`);
    } else if (originalStatus !== alert.status) { // e.g. MONITORING_STAY -> ACTIVE
        console.log(`[checkAlerts] Alert ${alert._id}: Condition NOT MET, but status changed from ${originalStatus} to ${alert.status}.`);
    } else {
        console.log(`[checkAlerts] Alert ${alert._id}: Condition NOT MET. Status remains ${alert.status}.`);
    }


    if (sendNotification) {
      console.log(`[checkAlerts] Alert ${alert._id}: Attempting to send notification.`);
      if (!globalWebhookUrl) {
        console.warn(`[checkAlerts] Alert ${alert._id} triggered but NO GLOBAL DISCORD WEBHOOK URL is set. Marking as ERROR_NO_WEBHOOK.`);
        alert.status = 'ERROR_NO_WEBHOOK';
        // No need to update last_triggered_timestamp if notification failed due to no webhook
      } else {
        const notificationResult = await sendDiscordNotification(alert, currentPrice, priceInfo.formula); // Pass formula if available
        if (notificationResult.success) {
          console.log(`[checkAlerts] Alert ${alert._id}: Discord notification sent successfully.`);
          if (!alert.initial_trigger_timestamp && (alert.status === 'TRIGGERED_ONCE' || alert.status === 'MONITORING_STAY')) {
            alert.initial_trigger_timestamp = now;
            console.log(`[checkAlerts] Alert ${alert._id}: Setting initial_trigger_timestamp.`);
          }
          alert.last_triggered_timestamp = now;
          console.log(`[checkAlerts] Alert ${alert._id}: Updated last_triggered_timestamp.`);
        } else { // Notification failed for other reasons (e.g. invalid webhook, Discord API error)
            console.error(`[checkAlerts] Alert ${alert._id}: Failed to send Discord notification. Error: ${notificationResult.error}`);
            if (notificationResult.error === 'NO_WEBHOOK_URL' || notificationResult.error === 'Invalid Webhook URL') { // Specific check if sendDiscordNotification returns this
                alert.status = 'ERROR_NO_WEBHOOK'; // Can also be set if the alert-specific webhook is bad
                console.log(`[checkAlerts] Alert ${alert._id}: Status set to ERROR_NO_WEBHOOK due to notification failure.`);
            } else {
                // For other notification errors, you might decide on a different status or just log
                // For now, we don't change the primary status like TRIGGERED_ONCE or MONITORING_STAY
                // but you could add an 'ERROR_NOTIFICATION_FAILED' status if desired.
                console.warn(`[checkAlerts] Alert ${alert._id}: Notification failed, but alert status (${alert.status}) not changed to an error state for this specific notification error type.`);
            }
        }
      }
    }
    try {
        await alert.save();
        if (sendNotification || originalStatus !== alert.status) {
            console.log(`[checkAlerts] Alert ${alert._id} saved. Final status: ${alert.status}.`);
        }
    } catch (saveError) {
        console.error(`[checkAlerts] CRITICAL: Error saving alert ${alert._id} after condition processing:`, saveError);
    }
  }
  console.log(`[${new Date().toISOString()}] Finished checking alerts.`);
  console.log('-----------------------------------------------------');
};

module.exports = { checkAlerts, fetchLatestPrice };
