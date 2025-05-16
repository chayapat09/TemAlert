import React, { createContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(null);
  const [isWebhookLoading, setIsWebhookLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getAlerts();
      setAlerts(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError(err.response?.data?.message || "Failed to fetch alerts");
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDiscordWebhook = useCallback(async () => {
    try {
        setIsWebhookLoading(true);
        const response = await api.getDiscordWebhookUrl();
        setDiscordWebhookUrl(response.data.webhook_url);
    } catch (err) {
        console.error("Error fetching Discord webhook URL:", err);
    } finally {
        setIsWebhookLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchAlerts();
    fetchDiscordWebhook();
  }, [fetchAlerts, fetchDiscordWebhook]);

  const addAlert = async (alertData) => {
    try {
      const response = await api.createAlert(alertData);
      setAlerts(prevAlerts => [response.data, ...prevAlerts].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      return response.data;
    } catch (err) {
      console.error("Error adding alert:", err);
      throw err.response?.data?.message || "Failed to add alert";
    }
  };

  const editAlert = async (id, alertData) => {
    try {
      const response = await api.updateAlert(id, alertData);
      setAlerts(prevAlerts => prevAlerts.map(a => (a._id === id ? response.data : a)));
      return response.data;
    } catch (err) {
      console.error("Error updating alert:", err);
      throw err.response?.data?.message || "Failed to update alert";
    }
  };

  const removeAlert = async (id) => {
    try {
      await api.deleteAlert(id);
      setAlerts(prevAlerts => prevAlerts.filter(a => a._id !== id));
    } catch (err) {
      console.error("Error deleting alert:", err);
      throw err.response?.data?.message || "Failed to delete alert";
    }
  };

  const saveDiscordWebhook = async (url) => {
    try {
        const response = await api.setDiscordWebhookUrl(url);
        setDiscordWebhookUrl(response.data.webhook_url);
    } catch (err) {
        console.error("Error saving Discord webhook URL:", err);
        throw err.response?.data?.message || "Failed to save webhook URL";
    }
  };


  return (
    <AppContext.Provider value={{
      alerts,
      isLoading,
      error,
      fetchAlerts,
      addAlert,
      editAlert,
      removeAlert,
      discordWebhookUrl,
      isWebhookLoading,
      saveDiscordWebhook,
      fetchDiscordWebhook,
    }}>
      {children}
    </AppContext.Provider>
  );
};
