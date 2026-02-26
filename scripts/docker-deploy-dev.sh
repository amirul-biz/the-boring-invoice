#!/bin/bash
set -e

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "development" ]; then
  echo "ERROR: switch to development branch first (current: $BRANCH)"
  exit 1
fi

docker build -f apps/api/Dockerfile -t amirulbiz/dev-the-boring-invoice-api:latest .
docker push amirulbiz/dev-the-boring-invoice-api:latest
echo "Done! Pushed amirulbiz/dev-the-boring-invoice-api:latest"
