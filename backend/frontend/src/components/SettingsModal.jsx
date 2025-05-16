import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';

const SettingsModal = ({ isOpen, onClose }) => {
  const { discordWebhookUrl, saveDiscordWebhook, isWebhookLoading } = useContext(AppContext);
  const [webhookInput, setWebhookInput] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen && discordWebhookUrl !== null) { 
      setWebhookInput(discordWebhookUrl);
    }
     if (isOpen && discordWebhookUrl === null && !isWebhookLoading) {
        setWebhookInput(''); 
    }
  }, [isOpen, discordWebhookUrl, isWebhookLoading]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setMessage('');
    try {
      await saveDiscordWebhook(webhookInput);
      setMessage('Webhook URL saved successfully!');
    } catch (error) {
      setMessage(`Error: ${error.toString()}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> 
        <h2>Application Settings</h2>
        {isWebhookLoading && <p>Loading webhook settings...</p>}
        {!isWebhookLoading && (
            <div className="form-group">
            <label htmlFor="discordWebhook">Global Discord Webhook URL:</label>
            <input
                type="text"
                id="discordWebhook"
                value={webhookInput || ''}
                onChange={(e) => setWebhookInput(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
            />
            <small>All notifications will be sent to this URL. <a href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" target="_blank" rel="noopener noreferrer">How to create a webhook?</a></small>
            </div>
        )}

        {message && <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}

        <div className="form-actions">
          <button onClick={onClose} className="secondary">Close</button>
          {!isWebhookLoading && <button onClick={handleSave} className="primary">Save Webhook URL</button>}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
