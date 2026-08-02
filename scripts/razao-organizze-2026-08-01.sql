-- =====================================================================
-- RAZÃO PARALELO DO ORGANIZZE NA CONTA NUBANK FAMÍLIA  -- 2026-08-01
-- =====================================================================
-- CONTEXTO (varredura 01/08, conta 9225d426-84a9-4b0b-a28b-d5fc23a3600d):
--   665 movimentos na conta, sendo 436 de "razão paralelo":
--     432 fonte='organizze' (lançamentos planejados/manuais do Organizze)
--       4 hash 'v2%'        (mesma natureza, importados do app antigo)
--   Feed real do banco = 229 (nu_ 112 + pluggy_ 115 + load/app 2).
--   Só 41 das 432 são duplicata exata (mesmo valor/sinal, ±3 dias) do
--   feed real — o resto é o mesmo dinheiro com valor/data diferentes,
--   OU meses onde o feed real está incompleto (abr: só 21 reais,
--   mai: só 12 reais). 431/432 têm categoria.
--   Saldo exibido NÃO muda em nenhuma opção (saldo_atual é override).
--
-- DECISÃO 01/08 (Gustavo: "siga o caminho recomendado") = BLOCO B (mover),
-- complementado no app pela v6.3.0: conta com "(fora do extrato)" no nome
-- sai de KPIs/gráficos (via isInterno). RODAR SÓ O BLOCO B.
-- ESTE ARQUIVO TEM 2 BLOCOS INDEPENDENTES — RODAR NO MÁXIMO UM,
-- conforme a decisão do Gustavo:
--   BLOCO A = APAGAR as 436 (com backup bkp_movimentos_razao_20260801)
--   BLOCO B = MOVER as 436 para "Família · Manual (fora do extrato)"
--             (reversível: a fonte/hash continua identificando as linhas)
--   Opção C = manter como está → não rodar nada.
-- Cada bloco é atômico: contagem errada → RAISE EXCEPTION → nada muda.
-- =====================================================================

-- ============================ BLOCO A ================================
-- APAGAR as 436 linhas do razão paralelo (backup antes, tudo ou nada)
/*
DO $$
DECLARE n int;
BEGIN
  CREATE TABLE IF NOT EXISTS bkp_movimentos_razao_20260801
    (LIKE movimentos INCLUDING ALL);
  ALTER TABLE bkp_movimentos_razao_20260801 ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON bkp_movimentos_razao_20260801 FROM anon, authenticated;

  INSERT INTO bkp_movimentos_razao_20260801
  SELECT * FROM movimentos
  WHERE conta_id = '9225d426-84a9-4b0b-a28b-d5fc23a3600d'
    AND (fonte = 'organizze' OR hash LIKE 'v2%');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 436 THEN
    RAISE EXCEPTION 'backup esperava 436 linhas, achou % — nada foi alterado', n;
  END IF;

  DELETE FROM movimentos
  WHERE conta_id = '9225d426-84a9-4b0b-a28b-d5fc23a3600d'
    AND (fonte = 'organizze' OR hash LIKE 'v2%');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 436 THEN
    RAISE EXCEPTION 'delete esperava 436 linhas, apagou % — rollback', n;
  END IF;
END $$;

-- conferência (esperado: restam 229, backup 436)
SELECT (SELECT count(*) FROM movimentos
         WHERE conta_id='9225d426-84a9-4b0b-a28b-d5fc23a3600d') AS restam,
       (SELECT count(*) FROM bkp_movimentos_razao_20260801)      AS backup;
*/

-- ============================ BLOCO B ================================
-- MOVER as 436 linhas para a conta "Família · Manual (fora do extrato)"
-- (conta 0b021afc-5d6b-4a73-bd97-0fbaf3030eae, saldo_atual=0 travado)
/*
DO $$
DECLARE n int;
BEGIN
  UPDATE movimentos
     SET conta_id = '0b021afc-5d6b-4a73-bd97-0fbaf3030eae'
   WHERE conta_id = '9225d426-84a9-4b0b-a28b-d5fc23a3600d'
     AND (fonte = 'organizze' OR hash LIKE 'v2%');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 436 THEN
    RAISE EXCEPTION 'update esperava 436 linhas, mudou % — rollback', n;
  END IF;
END $$;

-- conferência (esperado: nubank 229, manual 456 = 20 que já tinha + 436)
SELECT (SELECT count(*) FROM movimentos
         WHERE conta_id='9225d426-84a9-4b0b-a28b-d5fc23a3600d') AS nubank,
       (SELECT count(*) FROM movimentos
         WHERE conta_id='0b021afc-5d6b-4a73-bd97-0fbaf3030eae') AS manual;

-- desfazer (se precisar): mesmo UPDATE com os conta_id trocados.
*/
