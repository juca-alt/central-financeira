-- =====================================================================
-- LIMPEZA DE DUPLICATAS CRUZADAS ENTRE FONTES DE SYNC  -- 2026-07-30
-- =====================================================================
-- CONTEXTO: 3 pipelines gravaram na MESMA conta sem dedup cruzado:
--   organizze:*  (sync Organizze  - cron DESABILITADO em 02/07/2026)
--   nu_*         (sync Nubank por e-mail - cron DESABILITADO)
--   pluggy_*     (sync Pluggy - ATIVO, cron diario 06h40 BRT)
-- O dedup de cada pipeline so enxerga o proprio prefixo de hash, entao a
-- mesma transacao entrou ate 3x. Contas afetadas (varredura 30/07):
--   Conta Nubank Familia .... 29 grupos / 48 linhas extras / R$ 1.429,39
--   Cartao Inter Empresas ...  3 grupos /  3 linhas extras / R$  -112,90
--   Cartao Inter PF .........  1 grupo  /  1 linha  extra  / R$   -14,00
--   TOTAL ................... 52 linhas
-- Inter PJ, Inter PF, Pru Wallet, C6 PF, C6 PJ = ZERO duplicatas.
--
-- REGRA (a mesma validada em JS antes de gerar este arquivo):
--   Grupo = mesma conta + mesma data + mesmo valor + mesmo sinal.
--   Quantas ficam = MAIOR contagem que UMA UNICA fonte tem no grupo
--     (count-aware: se o Pluggy traz 2 Ubers de R$ 20 no mesmo dia,
--      os 2 sao legitimos e ficam os 2).
--   Quais ficam = por prioridade de confiabilidade/estabilidade:
--     pluggy/inter (syncs ATIVOS - se apagar, voltam no proximo cron)
--     > nu (extrato oficial por e-mail) > carga manual de extrato
--     > v2/import > organizze (legado, cron desligado) > outros.
--
-- COMO RODAR: SQL Editor do Supabase, projeto mieqsiojvfiqrhectquc,
-- EM ABA NOVA, os 4 passos NA ORDEM. O passo 1 tem que devolver 52.
-- =====================================================================

-- ---------- PASSO 1: CONFERIR (nao altera nada) ----------------------
WITH g AS (
  SELECT id, conta_id, data, valor, sinal, hash,
    CASE WHEN hash LIKE 'pluggy\_%' OR hash LIKE 'inter\_%' THEN 0
         WHEN hash LIKE 'nu\_%'                             THEN 1
         WHEN hash LIKE 'pru\_%' OR hash LIKE 'extpf\_%'    THEN 2
         WHEN hash LIKE 'load%'                             THEN 3
         WHEN hash LIKE 'v2\_%'                             THEN 4
         WHEN hash LIKE 'organizze%'                        THEN 5
         ELSE 6 END AS prio,
    CASE WHEN hash LIKE 'pluggy\_%' THEN 'pluggy'
         WHEN hash LIKE 'inter\_%'  THEN 'inter'
         WHEN hash LIKE 'nu\_%'     THEN 'nu'
         WHEN hash LIKE 'pru\_%'    THEN 'pru'
         WHEN hash LIKE 'extpf\_%'  THEN 'extpf'
         WHEN hash LIKE 'load%'     THEN 'load'
         WHEN hash LIKE 'v2\_%'     THEN 'v2'
         WHEN hash LIKE 'organizze%' THEN 'organizze'
         ELSE 'outro' END AS fonte
  FROM movimentos
  WHERE conta_id IN ('9225d426-84a9-4b0b-a28b-d5fc23a3600d',
                     '60c8d610-7c7f-48f9-9209-badb38c1aa80',
                     '30b25937-05d8-4350-bc0e-fc5219b6e661')
),
por_fonte AS (
  SELECT conta_id, data, valor, sinal, fonte, COUNT(*) AS c
  FROM g GROUP BY 1,2,3,4,5
),
manter AS (
  SELECT conta_id, data, valor, sinal, MAX(c) AS quantas
  FROM por_fonte GROUP BY 1,2,3,4
),
rk AS (
  SELECT g.*, m.quantas,
         ROW_NUMBER() OVER (PARTITION BY g.conta_id, g.data, g.valor, g.sinal
                            ORDER BY g.prio, g.id) AS rn
  FROM g JOIN manter m
    ON m.conta_id = g.conta_id AND m.data = g.data
   AND m.valor = g.valor AND m.sinal = g.sinal
)
SELECT COUNT(*) AS linhas_a_apagar,          -- ESPERADO: 52
       SUM(valor * sinal)::numeric(12,2) AS impacto_liquido
FROM rk WHERE rn > quantas;

-- ---------- PASSO 2: BACKUP (reversivel) -----------------------------
CREATE TABLE bkp_movimentos_dup_20260730 AS
WITH g AS (
  SELECT id, conta_id, data, valor, sinal, hash,
    CASE WHEN hash LIKE 'pluggy\_%' OR hash LIKE 'inter\_%' THEN 0
         WHEN hash LIKE 'nu\_%'                             THEN 1
         WHEN hash LIKE 'pru\_%' OR hash LIKE 'extpf\_%'    THEN 2
         WHEN hash LIKE 'load%'                             THEN 3
         WHEN hash LIKE 'v2\_%'                             THEN 4
         WHEN hash LIKE 'organizze%'                        THEN 5
         ELSE 6 END AS prio,
    CASE WHEN hash LIKE 'pluggy\_%' THEN 'pluggy'
         WHEN hash LIKE 'inter\_%'  THEN 'inter'
         WHEN hash LIKE 'nu\_%'     THEN 'nu'
         WHEN hash LIKE 'pru\_%'    THEN 'pru'
         WHEN hash LIKE 'extpf\_%'  THEN 'extpf'
         WHEN hash LIKE 'load%'     THEN 'load'
         WHEN hash LIKE 'v2\_%'     THEN 'v2'
         WHEN hash LIKE 'organizze%' THEN 'organizze'
         ELSE 'outro' END AS fonte
  FROM movimentos
  WHERE conta_id IN ('9225d426-84a9-4b0b-a28b-d5fc23a3600d',
                     '60c8d610-7c7f-48f9-9209-badb38c1aa80',
                     '30b25937-05d8-4350-bc0e-fc5219b6e661')
),
por_fonte AS (
  SELECT conta_id, data, valor, sinal, fonte, COUNT(*) AS c
  FROM g GROUP BY 1,2,3,4,5
),
manter AS (
  SELECT conta_id, data, valor, sinal, MAX(c) AS quantas
  FROM por_fonte GROUP BY 1,2,3,4
),
rk AS (
  SELECT g.id, m.quantas,
         ROW_NUMBER() OVER (PARTITION BY g.conta_id, g.data, g.valor, g.sinal
                            ORDER BY g.prio, g.id) AS rn
  FROM g JOIN manter m
    ON m.conta_id = g.conta_id AND m.data = g.data
   AND m.valor = g.valor AND m.sinal = g.sinal
)
SELECT mo.* FROM movimentos mo
WHERE mo.id IN (SELECT id FROM rk WHERE rn > quantas);
-- confira: deve ter 52 linhas
SELECT COUNT(*) FROM bkp_movimentos_dup_20260730;

-- ---------- PASSO 3: APAGAR ------------------------------------------
DELETE FROM movimentos
WHERE id IN (SELECT id FROM bkp_movimentos_dup_20260730);

-- ---------- PASSO 4: VERIFICAR ---------------------------------------
SELECT c.nome,
       COUNT(*) AS movimentos,
       SUM(m.valor * m.sinal)::numeric(12,2) AS soma_cega,
       c.saldo_atual
FROM movimentos m JOIN contas c ON c.id = m.conta_id
WHERE m.conta_id IN ('9225d426-84a9-4b0b-a28b-d5fc23a3600d',
                     '60c8d610-7c7f-48f9-9209-badb38c1aa80',
                     '30b25937-05d8-4350-bc0e-fc5219b6e661')
GROUP BY c.nome, c.saldo_atual;

-- REVERTER (se algo parecer errado):
-- INSERT INTO movimentos SELECT * FROM bkp_movimentos_dup_20260730;


-- =====================================================================
-- BLOCO 2 (OPCIONAL, rodar so depois do bloco acima) -------------------
-- DUPLICATAS COM 1 DIA DE DEFASAGEM na Conta Nubank Familia.
-- Mesma transacao, mesmo valor e sinal, fontes diferentes, datas
-- vizinhas (o Pluggy costuma datar 1 dia depois do extrato oficial).
-- Sao 9 pares; em cada um FICA a linha do extrato oficial (hash nu_)
-- e sai a copia do Pluggy/Organizze. Impacto: tira ~R$ 4.246 de
-- entradas e saidas fantasmas de jun/jul (inclusive as 3 linhas de
-- 30/06 que o Pluggy jogou em 01/07 e sujavam o batimento de julho).
-- Conferido linha a linha em 30/07; o guard de conteudo do sync-pluggy
-- (janela +-3 dias) impede que o cron diario traga de volta.
-- =====================================================================
CREATE TABLE bkp_movimentos_dup_desloc_20260730 AS
SELECT * FROM movimentos WHERE id IN (
  '4fc38231-d23a-468e-892e-f0dc0f1f95f6','a0294694-5c64-440a-9c7f-ac4860b3aef2',
  '04c716b1-7bf4-4da3-8856-881c9c3494db','07e39bf4-e221-438c-b3a8-6ff6ca745424',
  '7a25281a-ddbe-48d8-b91a-82cb74c9738f','a333a7f4-be99-4a67-a2e8-112f2a0f7ebc',
  '40e2b37d-178c-4938-ac44-e9911f447475','a375e3d6-f325-4d31-9829-4d0e10df3f6d',
  '9ac53286-581e-4e4f-9b2c-903f35ee0ef5');
-- confira: deve ter 9 linhas
SELECT COUNT(*) FROM bkp_movimentos_dup_desloc_20260730;

DELETE FROM movimentos
WHERE id IN (SELECT id FROM bkp_movimentos_dup_desloc_20260730);

-- REVERTER: INSERT INTO movimentos SELECT * FROM bkp_movimentos_dup_desloc_20260730;
