
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './apps/App'; // Use the modular App router
import { BrowserRouter } from 'react-router-dom';
import { loadConfig } from './lib/loadConfig';
import { ConfigProvider } from './context/ConfigContext';
import "./index.css";

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

async function bootstrap() {
  const cfg = await loadConfig();
  const root = ReactDOM.createRoot(rootElement!);
  root.render(
    <React.StrictMode>
      <ConfigProvider cfg={cfg}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </React.StrictMode>
  );
}

bootstrap();
