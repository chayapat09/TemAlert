const axios = require('axios');
const AppSettings = require('../models/AppSettings');

const sendDiscordNotification = async (alert, currentPrice) => {
  try {
    const webhookSetting = await AppSettings.findOne({ setting_key: 'discord_webhook_url' });
    const webhookUrl = webhookSetting ? webhookSetting.setting_value : process.env.DISCORD_WEBHOOK_URL_GLOBAL_DEFAULT;

    if (!webhookUrl) {
      console.error(`Discord Webhook URL not configured. Cannot send notification for alert ID ${alert._id}`);
      return { success: false, error: 'NO_WEBHOOK_URL' };
    }

    let conditionText = '';
    let color = 0x7289DA; // Discord Blurple

    switch (alert.condition) {
      case 'PRICE_RISES_ABOVE':
        conditionText = `has risen above your target of **$${alert.target_price.toFixed(2)}**!`;
        color = 0x00FF00; // Green
        break;
      case 'PRICE_FALLS_BELOW':
        conditionText = `has fallen below your target of **$${alert.target_price.toFixed(2)}**!`;
        color = 0xFF0000; // Red
        break;
      case 'PRICE_STAYS_ABOVE':
        conditionText = `is staying above your target of **$${alert.target_price.toFixed(2)}**.`;
        color = 0x00BFFF; // Deep Sky Blue
        break;
      case 'PRICE_STAYS_BELOW':
        conditionText = `is staying below your target of **$${alert.target_price.toFixed(2)}**.`;
        color = 0xFFA500; // Orange
        break;
    }

    const embed = {
      title: `🔔 Price Alert: ${alert.ticker} 🔔`,
      description: `**${alert.ticker}** (${alert.asset_type}) ${conditionText}`,
      color: color,
      fields: [
        { name: 'Ticker', value: alert.ticker, inline: true },
        { name: 'Asset Type', value: alert.asset_type, inline: true },
        { name: 'Target Price', value: `$${alert.target_price.toFixed(2)}`, inline: true },
        { name: 'Current Price', value: `$${currentPrice.toFixed(2)}`, inline: true },
        { name: 'Condition Set', value: alert.condition.replace(/_/g, ' '), inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Stock Alerter Bot' }
    };

    await axios.post(webhookUrl, { embeds: [embed] });
    console.log(`Notification sent for ${alert.ticker} (${alert._id})`);
    return { success: true };

  } catch (error) {
    console.error(`Error sending Discord notification for ${alert.ticker}:`, error.response ? error.response.data : error.message);
    return { success: false, error: 'DISCORD_API_ERROR' };
  }
};

module.exports = { sendDiscordNotification };
