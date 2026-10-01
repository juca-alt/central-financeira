# Testes do conector de escrita (mcp-escrita)

Nada aqui usa dado real (repo publico). Fixtures ficticias, `Zz ...`, `@exemplo.invalid`.

| Arquivo | O que e |
|---|---|
| `00-schema-local.sql` | Replica so da ESTRUTURA das tabelas/funcoes que as RPCs `cf_*` tocam. So local. |
| `tN.test.sql` | Testes de SQL do ticket N, em `BEGIN ... ROLLBACK` (rodam local ou no SQL Editor). |
| `run-local.sh` | Banco `cf_teste` do zero + cada migracao 2x (idempotencia) + todos os `tN.test.sql`. |
| `e2e-seed.sql` / `e2e-local.mjs` | Ponta a ponta: cliente MCP -> Edge Function -> PostgREST -> Postgres. |

## Rodar

```bash
# Postgres local descartavel (porta 54329, socket em /var/tmp/cfpg)
export PGHOST=/var/tmp/cfpg PGPORT=54329 PGUSER=postgres
scripts/mcp-escrita/tests/run-local.sh

# e2e: semente + PostgREST (jwt-secret local) + proxy /rest/v1 + deno
psql -d cf_teste -f scripts/mcp-escrita/tests/e2e-seed.sql
#   postgrest com db-uri postgres://authenticator@/cf_teste, porta 3000
#   proxy que tira o prefixo /rest/v1 (porta 3001)
#   SUPABASE_URL=http://127.0.0.1:3001 SUPABASE_SERVICE_ROLE_KEY=<jwt service_role local> \
#   MCP_TOKEN=tok-dono deno run --allow-net --allow-env supabase/functions/mcp-financeiro/index.ts
node scripts/mcp-escrita/tests/e2e-local.mjs
```
