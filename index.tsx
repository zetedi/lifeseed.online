
import './utils/polyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("%c .seed Network Active ", "background: #059669; color: #fff; border-radius: 4px; padding: 4px; font-weight: bold;");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
