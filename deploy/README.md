# Deploy auf den vServer

Jeder Push auf `main` lässt die CI laufen und spielt genau den dort gebauten und getesteten Stand auf den vServer.
Gebaut wird in GitHub Actions, auf dem Server nichts.

Adresse (nach der Einrichtung): **https://beinggod-62-83-23-90.sslip.io**

## Wie das auf dem Server zusammenspielt

Auf dem vServer (`62.83.23.90`) laufen schon mehrere Apps. Die Ports 80 und 443 gehören dem Caddy der
**Haushalt-App** (Repo `j4nric/haushalt-app`, Ordner `infra/production`), dem _vorderen Caddy_. Er holt die
HTTPS-Zertifikate für alle Domains und leitet an die Apps weiter. Jede App bringt ihren Eintrag für ihn selbst mit
(Muster aus Stammtisch, `j4nric/skat-roguelite`, ADR 0024 dort): Unser Eintrag ist
[`deploy/site.caddy`](site.caddy). `up.sh` legt ihn als `beinggod.caddy` in das gemeinsame Docker-Volume `caddy-sites`;
der vordere Caddy (Label `edge.caddy=true`) importiert jede `*.caddy`-Datei darin und erreicht unseren Container über
das gemeinsame Netzwerk `edge`:

```
Browser ──HTTPS──▶ haushalt-prod-caddy-1 ──Netzwerk edge──▶ beinggod-web (unser Caddy, statische Dateien)
```

| Was                                          | Wo                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Netzwerk `edge`, Volume `caddy-sites`        | auf dem Server; `up.sh` legt beide an, falls sie fehlen                              |
| Eintrag für `beinggod-62-83-23-90.sslip.io`  | `deploy/site.caddy` in diesem Repo, im Volume als `beinggod.caddy`                   |
| Import, Label und Netzwerk im vorderen Caddy | Repo `j4nric/haushalt-app`: `infra/production/` (einmalig, für alle Apps)            |
| Unser Container mit Alias `beinggod-web`     | `deploy/docker-compose.yml` in diesem Repo                                           |
| Dateien auf dem Server                       | `/opt/being-god` (`site/`, `docker-compose.yml`, `Caddyfile`, `site.caddy`, `up.sh`) |

**Übergang.** Bisher stand ein Block für unsere Domain direkt in der Caddyfile der Haushalt-App, erreichbar über das
eigene Netzwerk `beinggod-proxy`. Bis ein späterer Haushalt-PR diesen alten Block löscht (nachdem alle Apps ihren
Eintrag ausgerollt haben), hängt unser Container in beiden Netzen mit demselben Alias `beinggod-web`. Jeder Hostname
darf auf dem Server nur einmal vorkommen; `site.caddy` enthält genau die Hosts des alten Blocks.

Die Domain kommt von sslip.io: Jede Subdomain mit eingebetteter IP zeigt automatisch auf diese IP – kostenlos und ohne
Registrierung. Eine eigene Domain ist später nur eine Änderung an `deploy/site.caddy`.

## Einmalige Einrichtung – genau in dieser Reihenfolge

**1. und 2. (erledigt bzw. Sache der Haushalt-App).** Früher wurden hier das Netzwerk `beinggod-proxy` von Hand
angelegt und ein Block im Haushalt-Caddy per Patch eingetragen. Das Netzwerk `edge` und das Volume `caddy-sites` legt
jetzt `up.sh` an; Import, Label und Netzwerk `edge` im vorderen Caddy kommen einmalig für alle Apps aus dem Repo
`j4nric/haushalt-app`. Danach prüfen, dass die anderen Apps weiterlaufen (siehe Fehlersuche).

**3. Ordner und Deploy-Schlüssel** auf dem Server. Der Nutzer `deploy` existiert schon (Stammtisch) und ist in der
Gruppe `docker`. Being God bekommt einen eigenen Ordner und einen eigenen Schlüssel:

```sh
sudo mkdir -p /opt/being-god && sudo chown deploy:deploy /opt/being-god
sudo -u deploy ssh-keygen -t ed25519 -N "" -C "being-god deploy" -f /home/deploy/.ssh/being-god-deploy
sudo -u deploy sh -c 'cat /home/deploy/.ssh/being-god-deploy.pub >> /home/deploy/.ssh/authorized_keys'
sudo cat /home/deploy/.ssh/being-god-deploy      # Inhalt in das Secret DEPLOY_SSH_KEY kopieren
sudo rm /home/deploy/.ssh/being-god-deploy       # danach vom Server löschen (der .pub-Teil bleibt)
```

**4. GitHub-Secrets** unter <https://github.com/j4nric/ecosystem-loop/settings/secrets/actions> → _New repository
secret_:

| Secret               | Wert                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| `DEPLOY_HOST`        | `62.83.23.90`                                                                      |
| `DEPLOY_USER`        | `deploy`                                                                           |
| `DEPLOY_SSH_KEY`     | privater Schlüssel aus Schritt 3, komplett mit `BEGIN`- und `END`-Zeile            |
| `DEPLOY_PATH`        | `/opt/being-god`                                                                   |
| `DEPLOY_KNOWN_HOSTS` | empfohlen: dieselbe Zeile wie im Stammtisch-Repo (`62.83.23.90 ssh-ed25519 AAAA…`) |

Und unter <https://github.com/j4nric/ecosystem-loop/settings/variables/actions> → _New repository variable_:

| Variable     | Wert                                    |
| ------------ | --------------------------------------- |
| `DEPLOY_URL` | `https://beinggod-62-83-23-90.sslip.io` |

`DEPLOY_URL` ist freiwillig: Ist sie gesetzt, prüft der Workflow nach dem Deploy, dass die Seite den neuen Stand
ausliefert (`/version.json` enthält den Commit).

**Host-Schlüssel (`DEPLOY_KNOWN_HOSTS`).** Ohne dieses Secret vertraut der Workflow dem Schlüssel, den `ssh-keyscan`
gerade sieht (mit Warnung im Lauf). Mit dem Secret prüft SSH streng. Wenn die Zeile nicht aus dem Stammtisch-Repo
übernommen wird, so holen und gegen den Fingerabdruck vergleichen, den der Server selbst nennt:

```sh
ssh-keyscan -t ed25519 62.83.23.90                     # eigener Rechner: Zeile "62.83.23.90 ssh-ed25519 AAAA…"
ssh-keyscan -t ed25519 62.83.23.90 | ssh-keygen -lf -  # ihr Fingerabdruck (SHA256:…)
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub       # auf dem Server: muss gleich sein
```

**5. Ersten Deploy starten:** <https://github.com/j4nric/ecosystem-loop/actions/workflows/deploy.yml> → _Run workflow_
(oder einfach den nächsten PR mergen). Danach ist das Spiel unter der Adresse oben erreichbar und lässt sich auf dem
iPhone über _Teilen → Zum Home-Bildschirm_ als App ablegen.

## Was bei jedem Deploy passiert (`.github/workflows/deploy.yml`)

1. **CI** (`ci.yml`, als `workflow_call`): Format, Lint, Typecheck, alle Tests, Datenprüfung, Absturz-Test der Bots,
   Web-Build. Der Build wird als Artefakt `web-dist` aufbewahrt. Außerdem prüft die CI `deploy/Caddyfile` und
   `deploy/site.caddy` mit `caddy validate` und `deploy/docker-compose.yml` mit `docker compose config`.
2. **Deploy** – nur wenn die CI komplett grün ist, nie zwei gleichzeitig:
   - `web-dist` laden, `version.json` mit Commit und Zeit dazulegen.
   - `site/` per `rsync --delete-after --delay-updates` nach `/opt/being-god/site`: neue Dateien landen erst unter
     vorläufigen Namen und werden am Ende gemeinsam umbenannt; niemand lädt einen halben Build.
   - `docker-compose.yml`, `Caddyfile`, `site.caddy`, `up.sh` nach `/opt/being-god`.
   - `up.sh`: Netzwerke `beinggod-proxy` und `edge` anlegen, falls sie fehlen; `docker compose pull` (Patch-Stände von
     `caddy:2.11-alpine`); Container starten; Caddy neu starten, wenn sich die Caddyfile geändert hat.
   - `up.sh`, Eintrag im vorderen Caddy: `site.caddy` allein mit `caddy validate` prüfen, den bisherigen Eintrag als
     `beinggod.caddy.prev` aufheben, den neuen als `beinggod.caddy` ins Volume `caddy-sites` legen. Dann den vorderen
     Caddy über `docker ps --filter label=edge.caddy=true` suchen, dort die ganze Konfiguration prüfen und
     `caddy reload` (ohne Neustart). Lehnt er sie ab, kommt `.prev` zurück und der Deploy schlägt fehl. Gibt es noch
     keinen Caddy mit dem Label, bleibt es bei einer Warnung; er lädt den Eintrag beim nächsten Start.
   - Mit `DEPLOY_URL`: prüfen, dass die Seite den neuen Commit ausliefert.

Ohne die vier Pflicht-Secrets wird der Server-Schritt mit einer Warnung übersprungen; der Lauf bleibt grün.

**Caching.** Vite legt gehashte Dateien unter `/assets/` ab: ein Jahr Cache. `index.html` und das Manifest werden immer
neu geprüft. Ein neuer Stand ist deshalb beim nächsten Neuladen da.

**Sicherheits-Header** (`deploy/Caddyfile`): `Content-Security-Policy` (nur eigene Quellen, `'unsafe-inline'` bei
Styles für React, `data:`/`blob:` für Three.js), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`;
der `Server`-Header fällt weg. Am 10.11.2026 gegen den Build in Chromium geprüft (Insel rendert, keine Verstöße).
Braucht eine neue Funktion mehr, zeigt die Browser-Konsole „Refused to …“ – dann die CSP hier anpassen.

**Spielstände** liegen nur im Browser der Spieler (localStorage). Auf dem Server gibt es keinen Zustand und nichts zu
sichern.

## Fehlersuche

```sh
cd /opt/being-god && docker compose ps
cd /opt/being-god && docker compose logs --tail 50
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'
docker run --rm -v caddy-sites:/sites caddy:2.11-alpine cat /sites/beinggod.caddy  # Eintrag im Volume
curl -s https://beinggod-62-83-23-90.sslip.io/version.json        # Commit des ausgelieferten Stands
curl -sI https://beinggod-62-83-23-90.sslip.io/ | grep -i content-security
sh /opt/being-god/up.sh                                            # alles neu starten
```

„tlsv1 alert internal error“ beim Abruf heißt: Der Haushalt-Caddy hat (noch) kein Zertifikat für die Domain –
entweder kennt er weder den alten Block noch `beinggod.caddy` (Import im Haushalt-Repo noch nicht ausgerollt), oder
Let's Encrypt stellt es gerade aus (erster Abruf, bis zu einer Minute).

Der Netzwerk-Befehl muss `being-god-web-1` und `haushalt-prod-caddy-1` zeigen. Fehlt der Caddy, ist der Haushalt-PR
noch nicht ausgerollt. Antwortet die Domain mit 502, läuft unser Container nicht (`docker compose ps`).

Schlägt der Deploy mit „Der vordere Caddy hat deploy/site.caddy abgelehnt“ fehl, steht die Meldung von
`caddy validate` direkt darüber im Log. Häufigster Grund: ein Hostname, den es auf dem Server schon gibt (etwa noch im
alten Block der Haushalt-Caddyfile).

Laufen nach dem Haushalt-Merge auch die anderen Apps? Kurz prüfen:

```sh
docker ps --format '{{.Names}}\t{{.Status}}' | sort
```

## Später

- **Eigene Domain:** DNS auf `62.83.23.90`, Host in `deploy/site.caddy` ergänzen (PR hier).
- **Altes Netz abbauen:** Sobald der alte Block im Haushalt-Caddy weg ist, `beinggod-proxy` aus
  `deploy/docker-compose.yml` und `up.sh` streichen.
- **Native Apps** (Capacitor, App Store/Play Store): eigener Weg, siehe `docs/entwicklungsplan.md` Phase 8.
