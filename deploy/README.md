# Deploy auf den vServer

Jeder Push auf `main` lässt die CI laufen und spielt genau den dort gebauten und getesteten Stand auf den vServer.
Gebaut wird in GitHub Actions, auf dem Server nichts.

Adresse (nach der Einrichtung): **https://beinggod-62-83-23-90.sslip.io**

## Wie das auf dem Server zusammenspielt

Auf dem vServer (`62.83.23.90`) laufen schon mehrere Apps. Die Ports 80 und 443 gehören dem Caddy der
**Haushalt-App** (Repo `j4nric/haushalt-app`, Ordner `infra/production`). Er holt die HTTPS-Zertifikate für alle
Domains und leitet je Domain über ein eigenes Docker-Netzwerk an die App weiter. Being God macht es genauso wie
Stammtisch (`j4nric/skat-roguelite`) und Uhrturm (`j4nric/auto-battle`):

```
Browser ──HTTPS──▶ haushalt-prod-caddy-1 ──Netzwerk beinggod-proxy──▶ beinggod-web (unser Caddy, statische Dateien)
```

| Was                                                           | Wo                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Netzwerk `beinggod-proxy`                                     | auf dem Server, einmalig angelegt                                                 |
| Block für `beinggod-62-83-23-90.sslip.io` + Netzwerk im Caddy | Repo `j4nric/haushalt-app`: `infra/production/Caddyfile` und `docker-compose.yml` |
| Unser Container mit Alias `beinggod-web`                      | `deploy/docker-compose.yml` in diesem Repo                                        |
| Dateien auf dem Server                                        | `/opt/being-god` (`site/`, `docker-compose.yml`, `Caddyfile`, `up.sh`)            |

Die Domain kommt von sslip.io: Jede Subdomain mit eingebetteter IP zeigt automatisch auf diese IP – kostenlos und ohne
Registrierung. Eine eigene Domain kann später den Block im Haushalt-Caddy ersetzen.

## Einmalige Einrichtung – genau in dieser Reihenfolge

> **Wichtig:** Schritt 1 muss vor Schritt 2 passieren. Die Haushalt-App rollt sich nach jedem Merge selbst aus;
> fehlt das Netzwerk dann noch, startet ihr Caddy nicht – und damit wären **alle** Apps auf dem Server offline.

**1. Netzwerk anlegen** (auf dem Server, per SSH als Nutzer mit Docker-Rechten):

```sh
docker network create beinggod-proxy
```

**2. Haushalt-Caddy erweitern.** Im Repo `j4nric/haushalt-app` müssen das Netzwerk und ein Block für unsere Domain
eingetragen werden. Die fertige Änderung liegt hier als [`deploy/haushalt-app.patch`](haushalt-app.patch) (zwei Dateien:
`infra/production/Caddyfile` und `infra/production/docker-compose.yml`, nach dem Muster von Stammtisch und Uhrturm).
Entweder in einer Claude-Sitzung mit Zugriff auf `haushalt-app` sagen: „Wende `deploy/haushalt-app.patch` aus
`j4nric/ecosystem-loop` an und erstelle einen PR“ – oder selbst:

```sh
git clone https://github.com/j4nric/haushalt-app.git && cd haushalt-app
git checkout -b being-god-proxy
curl -fsSL https://raw.githubusercontent.com/j4nric/ecosystem-loop/main/deploy/haushalt-app.patch | git apply
git commit -am "Being God hinter den Caddy hängen (Netzwerk beinggod-proxy)"
git push -u origin being-god-proxy   # dann PR öffnen und mergen
```

Der Haushalt-Deploy startet den Caddy nach dem Merge mit dem neuen Netzwerk neu. Danach prüfen, dass die anderen Apps
weiterlaufen (siehe Fehlersuche).

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
   Web-Build. Der Build wird als Artefakt `web-dist` aufbewahrt. Außerdem prüft die CI `deploy/Caddyfile` mit
   `caddy validate` und `deploy/docker-compose.yml` mit `docker compose config`.
2. **Deploy** – nur wenn die CI komplett grün ist, nie zwei gleichzeitig:
   - `web-dist` laden, `version.json` mit Commit und Zeit dazulegen.
   - `site/` per `rsync --delete-after --delay-updates` nach `/opt/being-god/site`: neue Dateien landen erst unter
     vorläufigen Namen und werden am Ende gemeinsam umbenannt; niemand lädt einen halben Build.
   - `docker-compose.yml`, `Caddyfile`, `up.sh` nach `/opt/being-god`.
   - `up.sh`: Netzwerk anlegen, falls es fehlt; `docker compose pull` (Patch-Stände von `caddy:2.11-alpine`); Container
     starten; Caddy neu starten, wenn sich die Caddyfile geändert hat.
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
docker network inspect beinggod-proxy --format '{{range .Containers}}{{.Name}} {{end}}'
curl -s https://beinggod-62-83-23-90.sslip.io/version.json        # Commit des ausgelieferten Stands
curl -sI https://beinggod-62-83-23-90.sslip.io/ | grep -i content-security
sh /opt/being-god/up.sh                                            # alles neu starten
```

Der Netzwerk-Befehl muss `being-god-web-1` und `haushalt-prod-caddy-1` zeigen. Fehlt der Caddy, ist der Haushalt-PR
noch nicht ausgerollt. Antwortet die Domain mit 502, läuft unser Container nicht (`docker compose ps`).

Laufen nach dem Haushalt-Merge auch die anderen Apps? Kurz prüfen:

```sh
docker ps --format '{{.Names}}\t{{.Status}}' | sort
```

## Später

- **Eigene Domain:** DNS auf `62.83.23.90`, im Haushalt-Caddy den Block umbenennen (PR dort).
- **Native Apps** (Capacitor, App Store/Play Store): eigener Weg, siehe `docs/entwicklungsplan.md` Phase 8.
