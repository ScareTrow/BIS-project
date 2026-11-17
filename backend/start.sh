#!/usr/bin/env bash
set -euo pipefail
export ASAR_ENV=production
python -m flask --app main:app prepare-deploy
python -m flask --app main:app seed-capabilities
python -m flask --app main:app set-telegram-webhook
exec gunicorn main:app --bind "0.0.0.0:${PORT:-10000}" --workers 1 --threads 4 --timeout 120
