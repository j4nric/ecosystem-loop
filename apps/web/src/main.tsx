import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createGameClient } from './client/index.ts';
import { locale } from './i18n/index.ts';
import './styles/app.css';

const { client, decks } = createGameClient(locale);
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App client={client} decks={decks} />
    </StrictMode>,
  );
}
