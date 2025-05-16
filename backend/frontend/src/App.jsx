import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import { AppContext, AppProvider } from './context/AppContext';
import Header from './components/Header';
import AlertCard from './components/AlertCard';
import AlertForm from './components/AlertForm';
import SettingsModal from './components/SettingsModal';

function AppContent() {
  const { alerts, isLoading, error, addAlert, editAlert, discordWebhookUrl, isWebhookLoading, fetchAlerts } = useContext(AppContext);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleAddAlert = () => {
    setEditingAlert(null);
    setIsFormOpen(true);
  };

  const handleEditAlert = (alert) => {
    setEditingAlert(alert);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (alertData) => {
    try {
      if (editingAlert) {
        await editAlert(editingAlert._id, alertData);
      } else {
        await addAlert(alertData);
      }
      setIsFormOpen(false);
      setEditingAlert(null);
    } catch (submitError) {
      alert(`Failed to save alert: ${submitError}`); 
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingAlert(null);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
        fetchAlerts(); // Periodically refresh alert data from backend
    }, 60000); // Refresh every 60 seconds
    return () => clearInterval(intervalId);
  }, [fetchAlerts]);


  return (
    <>
      <Header onAddAlert={handleAddAlert} onOpenSettings={() => setIsSettingsOpen(true)} />
      <div className="container">
        {isWebhookLoading && <p>Checking webhook configuration...</p>}
        {!isWebhookLoading && !discordWebhookUrl && (
          <div className="webhook-warning">
            ⚠️ Discord Webhook URL is not set. Notifications will not be sent.
            <button onClick={() => setIsSettingsOpen(true)}>Set Webhook in Settings</button>
          </div>
        )}

        {isLoading && <p>Loading alerts...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}

        {!isLoading && !error && alerts.length === 0 && (
          <div className="no-alerts">
            <p>No alerts configured yet.</p>
            <button onClick={handleAddAlert} className="primary">Add Your First Alert</button>
          </div>
        )}

        {!isLoading && !error && alerts.length > 0 && (
          <div className="alerts-list">
            {alerts.map(alert => (
              <AlertCard key={alert._id} alert={alert} onEdit={handleEditAlert} />
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <AlertForm
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          existingAlert={editingAlert}
        />
      )}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
