#!/bin/sh
# Apply schema migrations, then serve. Workers=1: runs are in-process (thread pool) and the
# live RunStore is per process; scale by max_concurrent_runs, not by uvicorn workers.
set -e
echo "[entrypoint] running alembic upgrade head"
alembic upgrade head
exec uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*' \
  --log-level "${INVEST_LOG_LEVEL:-info}"
