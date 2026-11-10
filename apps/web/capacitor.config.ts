import type { CapacitorConfig } from '@capacitor/cli';

// Native Hülle (Capacitor) für iOS. Die App selbst ist der Vite-Build in `dist`; `npm run ios:sync` baut ihn und
// kopiert ihn nach `ios/App/App/public`. Anleitung für den Mac: ios/README.md.
const config: CapacitorConfig = {
  // PLATZHALTER: Den endgültigen Bundle Identifier legt der Inhaber fest (umgekehrte Domain, weltweit eindeutig,
  // nach der ersten Veröffentlichung nicht mehr änderbar). Wird er in Xcode geändert, hier denselben Wert eintragen.
  appId: 'de.beinggod.app',
  appName: 'Being God',
  webDir: 'dist',
  // Hintergrund hinter der WebView (sichtbar beim Start und beim Gummiband-Effekt) – Himmelfarbe wie theme-color.
  backgroundColor: '#c8c4d6',
  ios: {
    // Die Seite regelt Safe Areas selbst über env(safe-area-inset-*) (viewport-fit=cover); die WebView rückt
    // nichts zusätzlich ein.
    contentInset: 'never',
    // Die Spielfläche scrollt nicht; Listen (Hilfe, Buch, Sheets) scrollen in eigenen Containern.
    scrollEnabled: false,
    backgroundColor: '#c8c4d6',
  },
  plugins: {
    // Eingebautes Plugin (Capacitor 8): dunkle Statusleisten-Schrift auf dem hellen Himmel, auch im Dunkelmodus.
    SystemBars: { style: 'LIGHT' },
  },
};

export default config;
