import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/', // Vite proxy will handle /myapi for app's own API
});

// Alerts API (uses /myapi which is proxied to our backend)
export const getAlerts = () => apiClient.get('/myapi/alerts');
export const createAlert = (alertData) => apiClient.post('/myapi/alerts', alertData);
export const updateAlert = (id, alertData) => apiClient.put(`/myapi/alerts/${id}`, alertData);
export const deleteAlert = (id) => apiClient.delete(`/myapi/alerts/${id}`);

// Settings API (uses /myapi)
export const getDiscordWebhookUrl = () => apiClient.get('/myapi/settings/discord-webhook');
export const setDiscordWebhookUrl = (url) => apiClient.put('/myapi/settings/discord-webhook', { webhook_url: url });

// Proxy to External Ticker Search API via our backend
// Frontend calls /myapi/proxy/tickers, which our backend then forwards to the actual external API
export const searchTickers = (query, assetType = null, limit = 10, page = 1, fuzzy = false) => {
  return apiClient.get('/myapi/proxy/tickers', { 
    params: { 
        query, 
        ...(assetType && { asset_type: assetType }),
        limit,
        page,
        ...(fuzzy && { fuzzy: String(fuzzy) }) // Ensure fuzzy is string if API expects "true"
    }
  });
};

// New function to fetch latest price for display purposes on the frontend
// This will also be proxied if EXTERNAL_API_BASE_URL is not directly accessible from frontend
// For now, assuming it calls an endpoint on our backend that proxies or if EXTERNAL_API_BASE_URL is accessible.
// Let's create a new proxy endpoint on our backend for this.
export const fetchLatestPriceForDisplay = (ticker, assetType) => {
    // This should call /myapi/proxy/latest for consistency with ticker search proxying
    return apiClient.get('/myapi/proxy/latest', {
        params: { ticker, asset_type: assetType }
    });
};
