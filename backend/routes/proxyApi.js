const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE_URL;

// GET /myapi/proxy/tickers (proxies to EXTERNAL_API_BASE/api/tickers)
router.get('/tickers', async (req, res) => {
  if (!EXTERNAL_API_BASE) {
    return res.status(500).json({ error: "External API endpoint not configured on server." });
  }

  const { query, asset_type, limit, page, fuzzy } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const response = await axios.get(`${EXTERNAL_API_BASE}/api/tickers`, {
      params: {
        query,
        ...(asset_type && { asset_type }),
        ...(limit && { limit }),
        ...(page && { page }),
        ...(fuzzy && { fuzzy }),
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error(`Error proxying /api/tickers for query "${query}":`, 
                  error.response ? JSON.stringify(error.response.data) : error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to fetch data from external ticker API." });
    }
  }
});

// GET /myapi/proxy/latest (proxies to EXTERNAL_API_BASE/api/latest)
router.get('/latest', async (req, res) => {
    if (!EXTERNAL_API_BASE) {
        return res.status(500).json({ error: "External API endpoint not configured on server." });
    }

    const { ticker, asset_type } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: "Ticker parameter is required" });
    }

    try {
        const response = await axios.get(`${EXTERNAL_API_BASE}/api/latest`, {
            params: {
                ticker,
                ...(asset_type && { asset_type }),
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error(`Error proxying /api/latest for ticker "${ticker}":`, 
                      error.response ? JSON.stringify(error.response.data) : error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "Failed to fetch latest price from external API." });
        }
    }
});

module.exports = router;
