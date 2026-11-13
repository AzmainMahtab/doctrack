#!/bin/sh
set -e
cp /run/secrets/mongo-keyfile /data/configdb/keyfile
chmod 400 /data/configdb/keyfile
chown mongodb:mongodb /data/configdb/keyfile
exec docker-entrypoint.sh "$@"
