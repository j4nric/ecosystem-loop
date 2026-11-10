# Being God als iOS-App (Capacitor)

Dieser Ordner ist das native Xcode-Projekt. Es ist nur eine Hülle: Darin läuft genau die Web-App aus `apps/web`
(Vite-Build in `dist`) in einer WKWebView. Erzeugt mit Capacitor 8.5.3 und **Swift Package Manager** – auf dem Mac
ist also kein CocoaPods nötig.

| Was                                | Wo                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Capacitor-Einstellungen            | `apps/web/capacitor.config.ts` (App-ID, Name, Statusleiste, WebView)      |
| Xcode-Projekt                      | `ios/App/App.xcodeproj`                                                   |
| Info.plist (Name, Hochformat …)    | `ios/App/App/Info.plist`                                                  |
| App-Icon (1024 × 1024, ohne Alpha) | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (aus `public/icon.svg`) |
| Startbild                          | `ios/App/App/Assets.xcassets/Splash.imageset/`                            |
| Web-Dateien in der App             | `ios/App/App/public` – wird von `ios:sync` erzeugt, nicht eingecheckt     |

## Einmalig: Mac vorbereiten

1. **Xcode** aus dem Mac App Store installieren (kostenlos, groß – dauert). Einmal starten, Lizenz bestätigen und die
   angebotenen Komponenten installieren lassen. Unter _Xcode → Settings → Components_ muss eine **iOS-Plattform**
   installiert sein (für das eigene iPhone die Version, die zum iOS auf dem Gerät passt).
2. **Node.js 22** installieren (z. B. von <https://nodejs.org> den LTS-Installer oder `brew install node@22`).
   Prüfen im Terminal: `node -v` zeigt `v22.…`.
3. **Apple-ID in Xcode anmelden:** _Xcode → Settings → Accounts → „+“ → Apple ID_. Eine normale Apple-ID reicht; daraus
   entsteht das kostenlose Team „_Dein Name_ (Personal Team)“. Ein bezahltes Developer-Konto ist dafür nicht nötig.

## App bauen und aufs iPhone bringen

Im Terminal:

```sh
git clone https://github.com/j4nric/ecosystem-loop.git
cd ecosystem-loop
npm ci                          # Abhängigkeiten (auch Capacitor)
npm run -w apps/web ios:sync    # Web-App bauen und ins Xcode-Projekt kopieren
npm run -w apps/web ios:open    # öffnet ios/App/App.xcodeproj in Xcode
```

Beim ersten Öffnen lädt Xcode das Swift-Paket `capacitor-swift-pm` (Statuszeile oben, „Resolving Package Graph“).
Abwarten, bis es fertig ist.

In Xcode:

1. Links im Navigator ganz oben das blaue Projekt **App** anklicken, unter _Targets_ **App** wählen.
2. Reiter **Signing & Capabilities**:
   - Häkchen **Automatically manage signing** gesetzt lassen.
   - **Team:** „_Dein Name_ (Personal Team)“ wählen.
   - **Bundle Identifier:** muss weltweit eindeutig sein. Der Platzhalter `de.beinggod.app` kann bei Apple schon
     vergeben sein; dann meldet Xcode „Failed to register bundle identifier“. In dem Fall etwas Eigenes eintragen, z. B.
     `de.<deinname>.beinggod`. **Denselben Wert** danach in `apps/web/capacitor.config.ts` bei `appId` eintragen und
     committen, damit Projekt und Konfiguration übereinstimmen. Achtung: Nach einer Veröffentlichung im App Store ist
     der Bundle Identifier nicht mehr änderbar – für TestFlight/App Store den endgültigen Wert festlegen.
3. **iPhone per Kabel** anschließen, entsperren, „Diesem Computer vertrauen?“ → _Vertrauen_.
4. **Entwicklermodus** auf dem iPhone einschalten (ab iOS 16): _Einstellungen → Datenschutz & Sicherheit →
   Entwicklermodus_ → an, iPhone neu starten, nach dem Neustart bestätigen. Der Schalter erscheint oft erst, nachdem
   das iPhone einmal mit Xcode verbunden war.
5. Oben in der Xcode-Leiste als Ziel das **eigene iPhone** wählen (nicht einen Simulator).
6. **Run** (▶ bzw. `⌘R`). Der erste Build dauert ein paar Minuten.
7. Beim ersten Start auf dem iPhone kommt evtl. „Nicht vertrauenswürdiger Entwickler“ – siehe Fehlerbilder unten.

Nach Änderungen an der Web-App genügt: `git pull`, `npm ci` (falls sich Abhängigkeiten geändert haben),
`npm run -w apps/web ios:sync`, in Xcode erneut **Run**.

Ohne iPhone ausprobieren: Als Ziel einen **Simulator** (z. B. „iPhone 16“) wählen und Run – dafür ist kein Team nötig.

## Kostenloses Konto: Einschränkungen

- Die installierte App ist **7 Tage gültig**. Danach startet sie nicht mehr; einfach wieder per Kabel in Xcode **Run**.
- Höchstens 3 eigene Apps gleichzeitig auf dem Gerät, wenige neue Bundle Identifier pro Woche.
- Kein TestFlight, kein App Store, keine Push-Mitteilungen. Dafür braucht es das Apple Developer Program
  (99 €/Jahr); danach kann die CI TestFlight-Builds hochladen.

## Fehlerbilder

| Meldung                                                                   | Abhilfe                                                                                                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone: **„Nicht vertrauenswürdiger Entwickler“**                         | _Einstellungen → Allgemein → VPN & Geräteverwaltung_ → unter „Entwickler-App“ die eigene Apple-ID antippen → _Vertrauen_. Dann die App erneut öffnen.       |
| Xcode: **„Failed to register bundle identifier“** / „No profiles for …“   | Bundle Identifier ist vergeben → eindeutigen Wert setzen (siehe oben), Team prüfen.                                                                         |
| Xcode: **„Signing for "App" requires a development team“**                | Unter _Signing & Capabilities_ das Personal Team wählen.                                                                                                    |
| Xcode: **„Developer Mode disabled“**                                      | Entwicklermodus auf dem iPhone einschalten (siehe Schritt 4) und neu starten.                                                                               |
| Xcode: Gerät „**unavailable**“ / „iOS … is not installed“                 | _Xcode → Settings → Components_: passende iOS-Plattform laden; Xcode ggf. aktualisieren, falls das iPhone ein neueres iOS hat.                              |
| App startet nach einer Woche nicht mehr                                   | 7-Tage-Gültigkeit des kostenlosen Kontos – in Xcode erneut Run.                                                                                             |
| App zeigt **weißen/leeren Bildschirm**                                    | `npm run -w apps/web ios:sync` vergessen (Ordner `ios/App/App/public` fehlt) → ausführen, Run. Fehler in der Web-App: Safari → _Entwickler_ → iPhone → App. |
| Xcode: **„Missing package product 'Capacitor'“** / Paketfehler            | _File → Packages → Reset Package Caches_, danach _Resolve Package Versions_. Internetverbindung nötig.                                                      |
| `cap sync` meldet **„could not find installation of ios platform“** o. Ä. | Im Repo-Wurzelverzeichnis `npm ci` ausführen; Befehle immer mit `npm run -w apps/web …` starten.                                                            |

Web-Inspektor: Bei Debug-Builds lässt sich die WebView in Safari auf dem Mac untersuchen
(_Safari → Einstellungen → Erweitert → „Funktionen für Webentwickler anzeigen“_, dann Menü _Entwickler → iPhone_).

## Was die native Hülle anders macht

- **Nur iPhone, nur Hochformat** (`TARGETED_DEVICE_FAMILY = 1`, `UISupportedInterfaceOrientations` in `Info.plist`); Architektur `arm64`. iPad kann später freigeschaltet werden.
- **Statusleiste:** dunkle Schrift auf dem hellen Himmel (`SystemBars.style: 'LIGHT'` in `capacitor.config.ts` und
  `UIStatusBarStyleDarkContent`), auch im Dunkelmodus des iPhones.
- **Safe Areas:** Die WebView rückt nichts ein (`ios.contentInset: 'never'`); die Seite nutzt wie im Browser
  `env(safe-area-inset-*)` mit `viewport-fit=cover`.
- **Sprache:** `CFBundleLocalizations` enthält `en` und `de`, damit die WebView auf deutschen Geräten Deutsch meldet
  (`navigator.languages`); sonst stünde die App immer auf Englisch.
- **Speicher:** Spielstand, Schöpfungsbuch und Einführungsstatus liegen wie im Browser in `localStorage`. Das
  funktioniert in WKWebView, iOS kann ihn bei Speichermangel aber räumen. Für dauerhafte Speicherung wäre später
  `@capacitor/preferences` sinnvoll (die Stores in `src/client` sind dafür schon austauschbar) – noch nicht umgebaut.

## Wartung

- `ios:sync` = `vite build && cap sync ios`: kopiert `dist` nach `ios/App/App/public`, schreibt
  `capacitor.config.json` und aktualisiert `CapApp-SPM/Package.swift` (nicht von Hand ändern).
- Capacitor-Pakete (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`) immer gemeinsam auf dieselbe Version heben,
  danach `ios:sync`.
- Icon neu erzeugen, wenn `public/icon.svg` sich ändert: 1024 × 1024 PNG **ohne Transparenz** nach
  `AppIcon.appiconset/AppIcon-512@2x.png` (z. B. per Playwright-Screenshot der SVG auf 1024 px).
- Lint/Prettier ignorieren diesen Ordner (`.prettierignore`, `eslint.config.js`).
