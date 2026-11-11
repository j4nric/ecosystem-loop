#!/bin/sh
# Startet oder aktualisiert den Container. Der Deploy-Job synchronisiert diese Datei
# nach $DEPLOY_PATH und führt sie dort aus. Von Hand: `sh /opt/being-god/up.sh`.
set -eu
cd "$(dirname "$0")"

# beinggod-proxy ist das alte Netz zum Haushalt-Caddy, `edge` das gemeinsame aller Apps
# (siehe deploy/README.md). Das alte bleibt, bis der Haushalt-Caddy umgezogen ist.
docker network inspect beinggod-proxy >/dev/null 2>&1 || docker network create beinggod-proxy
docker network inspect edge >/dev/null 2>&1 || docker network create edge

# Neue Patch-Stände des festgelegten Images (Sicherheitskorrekturen).
docker compose pull -q || echo "::warning::docker compose pull fehlgeschlagen; das vorhandene Image läuft weiter."

docker compose up -d --remove-orphans web

# Die Caddyfile ist als einzelne Datei eingebunden: rsync ersetzt die Datei, der
# laufende Container behält die alte. Bei Änderung Caddy neu starten.
sum=$(sha256sum Caddyfile | cut -d' ' -f1)
if [ "$sum" != "$(cat .caddyfile.sha256 2>/dev/null || true)" ]; then
  docker compose restart web
  echo "$sum" > .caddyfile.sha256
fi

# Unser Eintrag im vorderen Caddy (deploy/site.caddy). Erst allein prüfen, den
# bisherigen als .prev aufheben (ohne Endung .caddy, wird also nicht importiert), den
# neuen ins gemeinsame Volume legen, dann prüft der vordere Caddy seine ganze
# Konfiguration und lädt ohne Neustart neu. Lehnt er sie ab, kommt der bisherige
# Eintrag zurück und der Deploy schlägt fehl; der vordere Caddy läuft mit dem alten
# Stand weiter.
SITE_IMAGE=caddy:2.11-alpine
SITE_NAME=beinggod.caddy
docker volume inspect caddy-sites >/dev/null 2>&1 || docker volume create caddy-sites >/dev/null
docker run --rm -v caddy-sites:/sites -v "$PWD/site.caddy:/new.caddy:ro" "$SITE_IMAGE" sh -euc "
  caddy validate --config /new.caddy --adapter caddyfile >/dev/null 2>&1 || { caddy validate --config /new.caddy --adapter caddyfile; exit 1; }
  if [ -f /sites/$SITE_NAME ]; then cp /sites/$SITE_NAME /sites/$SITE_NAME.prev; else rm -f /sites/$SITE_NAME.prev; fi
  cp /new.caddy /sites/$SITE_NAME
"
front=$(docker ps -q --filter label=edge.caddy=true | head -n 1)
if [ -z "$front" ]; then
  echo "::warning::Noch kein vorderer Caddy mit Label edge.caddy=true; Eintrag liegt in caddy-sites und wird beim Start geladen."
elif docker exec "$front" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  docker exec "$front" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  echo "Vorderer Caddy: Eintrag geladen"
else
  docker exec "$front" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || true
  docker run --rm -v caddy-sites:/sites "$SITE_IMAGE" sh -euc "
    if [ -f /sites/$SITE_NAME.prev ]; then mv /sites/$SITE_NAME.prev /sites/$SITE_NAME; else rm -f /sites/$SITE_NAME; fi
  "
  echo "::error::Der vordere Caddy hat deploy/site.caddy abgelehnt (siehe oben); der bisherige Eintrag ist wieder da."
  exit 1
fi

docker compose ps
