#!/usr/bin/env bash
# (local) recria cf_teste + semente e reinicia a Edge em deno. Pressupoe postgrest/proxy em /var/tmp/cfe2e.
set -euo pipefail
cd "$(dirname "$0")/../../.."
export PGHOST=${PGHOST:-/var/tmp/cfpg} PGPORT=${PGPORT:-54329} PGUSER=${PGUSER:-postgres}
scripts/mcp-escrita/tests/run-local.sh > /dev/null
psql -q -X -v ON_ERROR_STOP=1 -d cf_teste -f scripts/mcp-escrita/tests/e2e-seed.sql 2>/dev/null
pkill -f "[s]upabase/functions/mcp-financeiro/index.ts" || true
pkill -USR1 -x postgrest || true   # recarrega o schema cache
E=/var/tmp/cfe2e
SUPABASE_URL=http://127.0.0.1:3001 SUPABASE_SERVICE_ROLE_KEY=$(cat $E/srk) MCP_TOKEN=tok-dono \
  nohup ${DENO:-/var/tmp/denotool/node_modules/.bin/deno} run --allow-net --allow-env supabase/functions/mcp-financeiro/index.ts > $E/edge.log 2>&1 &
sleep 4
