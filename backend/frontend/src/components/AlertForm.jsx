import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api'; // For ticker search and latest price

const AlertForm = ({ onSubmit, onCancel, existingAlert }) => {
  const [tickerSearchInput, setTickerSearchInput] = useState('');
  const [selectedTickerInfo, setSelectedTickerInfo] = useState(null); // { ticker, asset_type }
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [latestPrice, setLatestPrice] = useState(null); // This will now store the { price, timestamp, ... } object directly
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState('PRICE_RISES_ABOVE');
  const [renotificationFrequency, setRenotificationFrequency] = useState(60);

  const fetchLatestPriceForSelected = useCallback(async (tickerData) => {
    if (!tickerData || !tickerData.ticker || !tickerData.asset_type) {
      setLatestPrice(null);
      return;
    }
    setIsLoadingPrice(true);
    try {
      const response = await api.fetchLatestPriceForDisplay(tickerData.ticker, tickerData.asset_type);
      console.log('[AlertForm] Raw response for latest price:', response);
      if (response && response.data) {
        setLatestPrice(response.data); // Correct: use response.data
        if(response.data.error) {
            console.warn(`[AlertForm] API returned an error for ${tickerData.ticker}: ${response.data.error}`);
        }
      } else {
        throw new Error("Invalid response structure from API");
      }
    } catch (error) {
      console.error(`Error fetching latest price for ${tickerData.ticker}:`, error.message);
      setLatestPrice({ error: error.message || 'Could not fetch price', price: 'N/A' });
    } finally {
      setIsLoadingPrice(false);
    }
  }, []);

  useEffect(() => {
    if (existingAlert) {
      setTickerSearchInput(existingAlert.ticker);
      const currentSelectedTicker = { ticker: existingAlert.ticker, asset_type: existingAlert.asset_type };
      setSelectedTickerInfo(currentSelectedTicker);
      fetchLatestPriceForSelected(currentSelectedTicker);
      setTargetPrice(existingAlert.target_price.toString());
      setCondition(existingAlert.condition);
      setRenotificationFrequency(existingAlert.renotification_frequency_minutes || 0);
    } else {
      setTickerSearchInput('');
      setSelectedTickerInfo(null);
      setLatestPrice(null);
      setTargetPrice('');
      setCondition('PRICE_RISES_ABOVE');
      setRenotificationFrequency(60);
      setSearchResults([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAlert]); 

  const handleTickerSearchInternal = useCallback(async (query) => {
    if (query.length < 1) {
      setSearchResults([]);
      setLatestPrice(null);
      return;
    }
    setIsSearching(true);
    setLatestPrice(null); 
    try {
      const response = await api.searchTickers(query, null);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error("Error searching tickers:", error.response ? error.response.data : error.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const debouncedSearch = useCallback(debounce(handleTickerSearchInternal, 300), [handleTickerSearchInternal]);

  const handleTickerInputChange = (e) => {
    const query = e.target.value;
    setTickerSearchInput(query);
    setSelectedTickerInfo(null);
    setLatestPrice(null);
    debouncedSearch(query);
  };

  const handleSelectTicker = (tickerData) => {
    setTickerSearchInput(tickerData.ticker);
    const newSelectedTicker = { ticker: tickerData.ticker, asset_type: tickerData.asset_type };
    setSelectedTickerInfo(newSelectedTicker);
    fetchLatestPriceForSelected(newSelectedTicker);
    setSearchResults([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedTickerInfo) {
      alert("Please select a valid ticker from the search results.");
      return;
    }
    if (targetPrice === '' || isNaN(parseFloat(targetPrice))) {
      alert("Please enter a valid target price.");
      return;
    }

    const alertData = {
      ticker: selectedTickerInfo.ticker,
      asset_type: selectedTickerInfo.asset_type,
      target_price: parseFloat(targetPrice),
      condition,
    };

    if (condition === 'PRICE_STAYS_ABOVE' || condition === 'PRICE_STAYS_BELOW') {
      alertData.renotification_frequency_minutes = parseInt(renotificationFrequency) || 0;
    }

    onSubmit(alertData);
  };

  const showRenotificationInput = condition === 'PRICE_STAYS_ABOVE' || condition === 'PRICE_STAYS_BELOW';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> 
        <h2>{existingAlert ? 'Edit Alert' : 'Add New Alert'}</h2>
        <form onSubmit={handleSubmit}>
          {/* The .form-group around the search input will be the relative parent for the dropdown */}
          <div className="form-group"> 
            <label htmlFor="ticker-search">Search Ticker:</label>
            <input
              type="search"
              id="ticker-search"
              value={tickerSearchInput}
              onChange={handleTickerInputChange}
              placeholder="e.g., AAPL, BTCUSD"
              autoComplete="off"
              onFocus={() => { if(tickerSearchInput) debouncedSearch(tickerSearchInput);}} // Optional: re-trigger search on focus if input has value
            />
            {isSearching && <small>Searching...</small>}
            {searchResults.length > 0 && (
              <ul className="ticker-search-results">
                {searchResults.map((item) => (
                  <li key={item.ticker} onClick={() => handleSelectTicker(item)}>
                    {item.ticker} ({item.asset_type})
                    {item.formula && ` (Formula: ${item.formula})`}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedTickerInfo && (
            <div className="selected-ticker-info">
              <p>
                Selected: <strong>{selectedTickerInfo.ticker}</strong> ({selectedTickerInfo.asset_type})
              </p>
              {isLoadingPrice && <p><small>Fetching current price...</small></p>}
              {latestPrice && !latestPrice.error && typeof latestPrice.price === 'number' && selectedTickerInfo && (
                <p><small>Current Price: ${latestPrice.price.toFixed(selectedTickerInfo.asset_type === 'CURRENCY' ? 4 : 2)} (as of {new Date(latestPrice.timestamp).toLocaleTimeString()})</small></p>
              )}
              {latestPrice && latestPrice.error && (
                <p><small style={{color: 'red'}}>Current Price: {latestPrice.error}</small></p>
              )}
              {latestPrice && !latestPrice.error && typeof latestPrice.price !== 'number' && (
                <p><small style={{color: 'orange'}}>Current Price: Data unavailable or not a number</small></p>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="condition">Condition:</label>
            <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="PRICE_RISES_ABOVE">Price Rises Above</option>
              <option value="PRICE_FALLS_BELOW">Price Falls Below</option>
              <option value="PRICE_STAYS_ABOVE">Price Stays Above</option>
              <option value="PRICE_STAYS_BELOW">Price Stays Below</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="targetPrice">Target Price:</label>
            <input
              type="number"
              id="targetPrice"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              step="any"
              required
            />
          </div>

          {showRenotificationInput && (
            <div className="form-group">
              <label htmlFor="renotificationFrequency">Re-notify Every (minutes):</label>
              <input
                type="number"
                id="renotificationFrequency"
                value={renotificationFrequency}
                onChange={(e) => setRenotificationFrequency(e.target.value)}
                min="0"
                placeholder="0 for one-time (after initial)"
              />
              <small>Set to 0 or leave blank to notify only once when condition is first met.</small>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="secondary">Cancel</button>
            <button type="submit" className="primary">{existingAlert ? 'Update Alert' : 'Add Alert'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertForm;
