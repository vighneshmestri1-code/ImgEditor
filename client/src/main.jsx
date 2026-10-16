import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const container = document.getElementById('root');

// Store the root reference to prevent duplicate initialization during HMR reloads
if (!window._reactRoot) {
  window._reactRoot = ReactDOM.createRoot(container);
}

window._reactRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);