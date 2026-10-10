import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { applyPinColor, applyTheme, getSavedPinColor, getSavedTheme } from './styles/theme';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

applyTheme(getSavedTheme());
applyPinColor(getSavedPinColor());

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
