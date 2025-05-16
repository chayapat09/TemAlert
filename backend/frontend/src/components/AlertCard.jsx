import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import * as api from '../services/api'; // For fetching latest price on demand

const AlertCard = ({ alert, onEdit }) => {
  const { removeAlert, editAlert } = useContext(AppContext);
  const [latestPriceInfo, setLatestPriceInfo] = useState(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  const fetchCardLatestPrice = async () => {
    console.log(`[AlertCard] Attempting fetchCardLatestPrice for ${alert.ticker}, Status: ${alert.status}`);
    if (!alert.ticker || alert.status === 'TRIGGERED_ONCE' || alert.status === 'PAUSED') {
        console.log(`[AlertCard] Skipped fetching price for ${alert.ticker} due to status: ${alert.status} or no ticker.`);
        setIsLoadingPrice(false); 
        setLatestPriceInfo(null); // Clear previous price info if not fetching
        return;
    }
    console.log(`[AlertCard] Fetching price for ${alert.ticker}...`);
    setIsLoadingPrice(true);
    try {
      const response = await api.fetchLatestPriceForDisplay(alert.ticker, alert.asset_type);
      console.log(`[AlertCard] Received raw response for ${alert.ticker}:`, response);
      if (response && response.data) {
        setLatestPriceInfo(response.data); // Correctly access response.data
        if(response.data.error) {
            console.warn(`[AlertCard] API returned an error for ${alert.ticker}: ${response.data.error}`);
        }
      } else {
        throw new Error("Invalid response structure from API");
      }
    } catch (error) {
      console.error(`Error fetching latest price for ${alert.ticker} in card:`, error.message);
      // Ensure error state is an object with an error property and potentially a price placeholder
      setLatestPriceInfo({ error: error.message || 'N/A', price: 'N/A', timestamp: null }); 
    } finally {
      setIsLoadingPrice(false);
      console.log(`[AlertCard] Finished fetching price for ${alert.ticker}, isLoadingPrice: false`);
    }
  };

  useEffect(() => {
    console.log(`[AlertCard] useEffect triggered for ${alert.ticker}, deps: [${alert.ticker}, ${alert.asset_type}, ${alert.status}]`);
    fetchCardLatestPrice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert.ticker, alert.asset_type, alert.status]);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete the alert for ${alert.ticker}?`)) {
      try {
        await removeAlert(alert._id);
      } catch (error) {
        console.error("Card delete failed:", error)
      }
    }
  };

  const handleTogglePause = async () => {
    const newStatus = alert.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    try {
      await editAlert(alert._id, { status: newStatus });
    } catch (error) {
        console.error("Card pause/resume failed:", error)
    }
  };

  const formatCondition = (condition, target) => {
    switch (condition) {
      case 'PRICE_RISES_ABOVE': return `Price Rises Above $${target.toFixed(2)}`;
      case 'PRICE_FALLS_BELOW': return `Price Falls Below $${target.toFixed(2)}`;
      case 'PRICE_STAYS_ABOVE': return `Price Stays Above $${target.toFixed(2)}`;
      case 'PRICE_STAYS_BELOW': return `Price Stays Below $${target.toFixed(2)}`;
      default: return condition;
    }
  };

  let priceToShow = 'Loading...';
  let priceTimestamp = null;

  if (latestPriceInfo) {
    if (latestPriceInfo.error || typeof latestPriceInfo.price !== 'number') {
      priceToShow = 'N/A';
    } else {
      priceToShow = `$${latestPriceInfo.price.toFixed(alert.asset_type === 'CURRENCY' ? 4 : 2)}`;
      priceTimestamp = latestPriceInfo.timestamp;
    }
  } else if (alert.last_checked_price != null) {
    priceToShow = `$${alert.last_checked_price.toFixed(alert.asset_type === 'CURRENCY' ? 4 : 2)}`;
    priceTimestamp = alert.last_checked_timestamp; 
  }
  
  if (priceToShow === 'Loading...' && !isLoadingPrice && !latestPriceInfo && alert.last_checked_price == null) {
    priceToShow = 'No price data';
  }

  return (
    <div className="alert-card">
      <h3>{alert.ticker} <small>({alert.asset_type})</small></h3>
      <p><strong>Condition:</strong> {formatCondition(alert.condition, alert.target_price)}</p>
      <p>
        <strong>Current Price: </strong> 
        {isLoadingPrice ? 'Fetching...' : priceToShow}
        {priceTimestamp && priceToShow !== 'N/A' && priceToShow !== 'No price data' && priceToShow !== 'Loading...' &&
          <small> (as of {new Date(priceTimestamp).toLocaleTimeString()})</small>}
      </p>
      { (alert.condition === 'PRICE_STAYS_ABOVE' || alert.condition === 'PRICE_STAYS_BELOW') && alert.renotification_frequency_minutes > 0 &&
        <p><small>Re-notify every: {alert.renotification_frequency_minutes} min</small></p>
      }
      {priceToShow === 'N/A' && alert.last_checked_price != null && alert.last_checked_timestamp && latestPriceInfo && latestPriceInfo.error && (
        <p><small>Last Good Price (Backend): ${alert.last_checked_price.toFixed(alert.asset_type === 'CURRENCY' ? 4:2)} at {new Date(alert.last_checked_timestamp).toLocaleTimeString()}</small></p>
      )}
      <p>Status: <span className={`status status-${alert.status}`}>{alert.status.replace(/_/g, ' ')}</span></p>
      {alert.initial_trigger_timestamp && (
         <p><small>First Triggered: {new Date(alert.initial_trigger_timestamp).toLocaleString()}</small></p>
      )}
       {alert.last_triggered_timestamp && alert.status !== 'TRIGGERED_ONCE' && (alert.condition.includes('STAYS')) && (
         <p><small>Last Notified: {new Date(alert.last_triggered_timestamp).toLocaleString()}</small></p>
      )}

      <div className="alert-actions">
        <button onClick={() => onEdit(alert)} className="secondary">Edit</button>
        <button onClick={handleTogglePause} className="secondary">
          {alert.status === 'PAUSED' ? 'Resume' : 'Pause'}
        </button>
        <button onClick={handleDelete} className="danger">Delete</button>
        <button onClick={fetchCardLatestPrice} className="secondary small-btn" disabled={isLoadingPrice}>
          {isLoadingPrice ? '...' : 'Refresh Price'}
        </button>
      </div>
    </div>
  );
};

export default AlertCard;
