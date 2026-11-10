#!/bin/sh
# Startet oder aktualisiert den Container. Der Deploy-Job synchronisiert diese Datei
# nach $DEPLOY_PATH und führt sie dort aus. Von Hand: `sh /opt/being-god/up.sh`.
set -eu
cd "$(dirname "$0")"

docker network inspect beinggod-proxy >/dev/null 2>&1 || docker network create beinggod-proxy

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

docker compose ps
