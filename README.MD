# Stock Price Alerter Web App

This application allows users to monitor stock/crypto/currency prices and receive Discord notifications when specified price targets are met.

## Features

- Add, edit, and delete price alerts.
- Alert conditions:
    - Price Rises Above (triggers once)
    - Price Falls Below (triggers once)
    - Price Stays Above (can re-notify at a configurable frequency)
    - Price Stays Below (can re-notify at a configurable frequency)
- Ticker search functionality (proxied to your external API).
- Global Discord webhook configuration.
- Mobile-responsive basic UI.

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (with Mongoose), `node-cron`
- **Frontend:** React (with Vite), `axios`

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- MongoDB instance running
- Access to the external price and ticker APIs as specified.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd stock-alerter-app
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    npm install
    ```
    *   Create a `.env` file in the `backend` directory by copying `.env.example`.
    *   Update the `.env` file with your MongoDB URI, your actual `EXTERNAL_API_BASE_URL`, and optionally a default Discord Webhook URL and cron schedule.
        ```env
        MONGODB_URI=mongodb://localhost:27017/stock_alerter
        PORT=5001
        EXTERNAL_API_BASE_URL=http://your-actual-external-api.com 
        DISCORD_WEBHOOK_URL_GLOBAL_DEFAULT=
        CRON_SCHEDULE=*/1 * * * *
        ```
    *   Start the backend server:
        ```bash
        npm start
        # Or for development with auto-reload:
        # npm run dev
        ```
        The backend will run on `http://localhost:5001` by default.

3.  **Frontend Setup:**
    *   Open a new terminal.
    ```bash
    cd frontend
    npm install
    ```
    *   Start the frontend development server:
        ```bash
        npm run dev
        ```
        The frontend will run on `http://localhost:3000` by default and will proxy API requests (to `/myapi/*`) to the backend.

4.  **Access the Application:**
    Open your browser and navigate to `http://localhost:3000`.

## Usage

1.  **Configure Discord Webhook:**
    *   Click the "⚙️ Settings" button in the header.
    *   Enter your Discord channel's Webhook URL and save. Notifications will not work without this.
2.  **Add Alerts:**
    *   Click the "+ Add Alert" button.
    *   Search for a ticker. The search queries your `EXTERNAL_API_BASE_URL/api/tickers` endpoint via the backend proxy.
    *   Select the ticker from the search results.
    *   Choose the alert condition.
    *   Enter the target price.
    *   If using a "Stays Above/Below" condition, set the re-notification frequency in minutes (0 or blank for one-time notification after initial trigger).
    *   Save the alert.
3.  **Monitor Alerts:**
    *   The backend cron job will check alerts periodically by calling your `EXTERNAL_API_BASE_URL/api/latest`.
    *   When an alert condition is met, a notification will be sent to your configured Discord webhook.
    *   The UI will show the status of alerts and will periodically refresh.

## External API Integration Details

-   **Latest Price Data:** The backend service `alertProcessor.js` directly calls `GET {EXTERNAL_API_BASE_URL}/api/latest`.
-   **Ticker Search:** The frontend calls `/myapi/proxy/tickers` (an endpoint on this application's backend). This backend endpoint then calls `GET {EXTERNAL_API_BASE_URL}/api/tickers` and returns the result to the frontend. This proxy approach is used to manage API interactions centrally and avoid CORS issues for the frontend.

## Further Development

- Implement real user authentication.
- More robust error handling and logging.
- UI/UX improvements.
- Unit and integration tests.
- Option to "re-arm" `TRIGGERED_ONCE` alerts.
- More sophisticated alert conditions.
- Real-time updates to the frontend (e.g., via WebSockets).
