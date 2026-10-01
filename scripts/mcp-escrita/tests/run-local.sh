#!/usr/bin/env bash
# Roda migracoes + testes do conector de escrita num Postgres LOCAL descartavel.
# Uso: PGHOST=/var/tmp/cfpg PGPORT=54329 scripts/mcp-escrita/tests/run-local.sh
# Cria o banco cf_teste do zero, aplica a replica do schema, roda cada
# migracao DUAS vezes (idempotencia) e depois os testes (que fazem ROLLBACK).
set -euo pipefail
cd "$(dirname "$0")/.."
export PGUSER="${PGUSER:-postgres}"
DB=cf_teste
psql -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
P="psql -q -X -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00-schema-local.sql
# assinatura do schema: funcoes cf_* + colunas/indices de cf_* + grants
SIG="select md5(coalesce((select string_agg(pg_get_functiondef(p.oid) || coalesce(array_to_string(p.proacl, ','), ''), '' order by p.oid::regprocedure::text) from pg_proc p where p.proname like 'cf\_%'), '')
  || coalesce((select string_agg(table_name || column_name || data_type, ',' order by table_name, ordinal_position) from information_schema.columns where table_name like 'cf\_%'), '')
  || coalesce((select string_agg(indexdef, ',' order by indexname) from pg_indexes where tablename like 'cf\_%'), ''))"
for m in t[0-9]-*.sql; do
  $P -f "$m"; a=$(psql -X -tA -d $DB -c "$SIG")
  $P -f "$m"; b=$(psql -X -tA -d $DB -c "$SIG")
  [ "$a" = "$b" ] || { echo "FALHA: $m mudou o schema na 2a execucao"; exit 1; }
  echo "migracao 2x OK (schema identico $a): $m"
done
for t in tests/t[0-9].test.sql; do
  echo "== $t"
  $P -f "$t"
done
