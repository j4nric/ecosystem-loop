# Deploy der Web-App auf den eigenen vServer

Nach jedem Merge auf `main` baut GitHub Actions die Web-App (`apps/web`) und kopiert den statischen Build per
`rsync` über SSH in einen Ordner auf dem Server. Der Webserver liefert diesen Ordner aus. Solange die
Zugangsdaten fehlen, wird der Deploy übersprungen (der Lauf bleibt grün).

## Einmalig einrichten

1. **Deploy-Benutzer und Ordner auf dem Server** (Beispiel, als root):

   ```bash
   adduser --disabled-password --gecos "" deploy
   mkdir -p /var/www/being-god && chown deploy:deploy /var/www/being-god
   ```

2. **Eigenen SSH-Schlüssel nur für den Deploy** (auf deinem Rechner):

   ```bash
   ssh-keygen -t ed25519 -f being-god-deploy -C "being-god deploy" -N ""
   ```

   Den Inhalt von `being-god-deploy.pub` auf dem Server in `/home/deploy/.ssh/authorized_keys` eintragen.

3. **Webserver** (Beispiel nginx, statische Dateien):

   ```nginx
   server {
     server_name spiel.example.de;
     root /var/www/being-god;
     location / { try_files $uri $uri/ /index.html; }
     location ~* \.(js|css|png|svg|webmanifest)$ { expires 7d; }
   }
   ```

   HTTPS z. B. mit `certbot --nginx`. Für „Zum Home-Bildschirm“ auf dem iPhone ist HTTPS nötig.

4. **GitHub-Secrets** im Repo unter Settings → Secrets and variables → Actions → New repository secret:

   | Secret           | Beispiel                                     |
   | ---------------- | -------------------------------------------- |
   | `DEPLOY_HOST`    | `spiel.example.de` oder IP                   |
   | `DEPLOY_USER`    | `deploy`                                     |
   | `DEPLOY_PATH`    | `/var/www/being-god`                         |
   | `DEPLOY_SSH_KEY` | Inhalt der privaten Datei `being-god-deploy` |
   | `DEPLOY_PORT`    | optional, Standard 22                        |

5. Unter Actions → „Deploy Web-App“ → „Run workflow“ einmal manuell starten.

Danach geht jeder Merge auf `main` automatisch live.
