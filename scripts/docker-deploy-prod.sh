#!/bin/bash
set -e

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: switch to main branch first (current: $BRANCH)"
  exit 1
fi

docker build -f apps/api/Dockerfile -t amirulbiz/the-boring-invoice-api:latest .
docker push amirulbiz/the-boring-invoice-api:latest
echo "Done! Pushed amirulbiz/the-boring-invoice-api:latest"
