import React from 'react';

const Header = ({ onAddAlert, onOpenSettings }) => {
  return (
    <header className="app-header">
      <h1>Stock Alerter</h1>
      <div>
        <button onClick={onOpenSettings} style={{ marginRight: '10px' }}>⚙️ Settings</button>
        <button onClick={onAddAlert}>+ Add Alert</button>
      </div>
    </header>
  );
};

export default Header;
