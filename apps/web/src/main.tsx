import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createGameClient } from './client/index.ts';
import { locale, t } from './i18n/index.ts';
import './styles/app.css';

const client = createGameClient(locale, t);
document.title = t.appTitle;
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App client={client} />
    </StrictMode>,
  );
}
