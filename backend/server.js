require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path'); // Added for serving static files
const connectDB = require('./config/db');
const { checkAlerts } = require('./services/alertProcessor');

const alertRoutes = require('./routes/alerts');
const settingRoutes = require('./routes/settings');
const proxyApiRoutes = require('./routes/proxyApi');

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Define API Routes
app.use('/myapi/alerts', alertRoutes);
app.use('/myapi/settings', settingRoutes);
app.use('/myapi/proxy', proxyApiRoutes);

// --- Serve Frontend --- 
// Check if in production, otherwise Vite dev server handles frontend
if (process.env.NODE_ENV === 'production' || true) { // Forcing true for this example to always serve
    // Serve static files from the React app build directory
    app.use(express.static(path.join(__dirname, 'frontend/dist')));

    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    app.get('*', (req, res) => {
        // Ensure API calls are not caught by this wildcard
        if (!req.path.startsWith('/myapi')) {
            res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
        } else {
            // If it's an API call that wasn't matched, send 404
            res.status(404).send('API endpoint not found');
        }
    });
} else {
    app.get('/', (req, res) => {
        res.send('API is running... Frontend likely on Vite dev server.');
    });
}

// Cron job for checking alerts
const cronSchedule = process.env.CRON_SCHEDULE || '*/1 * * * *'; 
if (cron.validate(cronSchedule)) {
    cron.schedule(cronSchedule, () => {
      console.log(`Running cron job at ${new Date().toISOString()} with schedule: ${cronSchedule}`);
      checkAlerts();
    });
    console.log(`Alert check cron job scheduled with: ${cronSchedule}`);
} else {
    console.error(`Invalid cron schedule in .env: ${cronSchedule}. Alert checking will not run.`);
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}, serving frontend if in production mode.`));
