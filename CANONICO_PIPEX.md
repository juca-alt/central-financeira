# CANÔNICO · Pipe X (parceria com o Daniel) — visão financeira

> Atualizado em 30/09/2026 · app v8.4.0. **Repo público:** nenhum nome de cliente, apólice ou valor real aqui.
> Os números reais vivem só no banco (`mieqsiojvfiqrhectquc`) e na carga privada (fora do git).

## O que é
Carteira que o Gustavo repassou ao Life Planner Daniel. Todo mês o Daniel recebe a comissão da Prudential
e repassa à Pipe X a parte combinada por cliente. O módulo **Pipe X** (menu da visão PIPEX) controla
apuração → a receber → conciliação → prestação de contas → projeção. Substitui os 4 artefatos HTML soltos
e a grade editável sobre `pipex_state`.

## Regra (fonte única = banco)
| Item | Regra | Onde |
|---|---|---|
| Parte Pipe X | comissão do Daniel × % do cliente × (1 − 6% Simples) | `pipex_fator` / `pipex_parte` |
| Arredondamento | realizado: 2 casas **por apólice × competência**; projeção: só o total do mês | `pipex_v_apuracao` / `pipex_projecao` |
| % | por cliente, com vigência (`desde` = competência). Mudar = nova linha; histórico preservado | `pipex_acordo_pct` |
| Competência | janela do extrato (~21→20); rótulo `Mmm/aa`; vencimento dia 05 do mês seguinte | `pipex_competencias` |
| Parcelas juntas | parcelas atrasadas que compensam no mesmo extrato são linhas reais e entram cheias | chave da linha |
| Não compensou | cliente do acordo fora do extrato **não cancelou** — cai no próximo ciclo | `situacao = nao_compensou` |
| Projeção | FYC restante = (12 − última parcela) × comissão mensal; renovação 13ª–24ª = 8% × prêmio líquido mensal. Premissa: todos pagam em dia | `pipex_projecao(p_inicio, p_cenario)` |

A tela **não recalcula** parte/Simples/devido (há self-check que acusa `0.94`/`0.06` nas telas).

## Modelo (`scripts/pipex_modulo.sql`, idempotente, RLS por dono `owner_id = auth.uid()`)
- `pipex_acordo` — apólices do acordo + base da projeção (`ult_parcela`, `comissao_mensal`, `premio_mensal`, `base_comp`; atualizada no fechamento).
- `pipex_acordo_pct` — % por apólice com vigência.
- `pipex_competencias` — uma por competência: período, vencimento, total/linhas do extrato, `fonte` (`extrato` | `historico`), `status` (`aberta` | `fechada`), `devido` congelado, `previsto_id`.
- `pipex_extrato_linhas` — linhas reais do extrato (livro inteiro do Daniel). Identidade: competência + apólice + cobertura + parcela + data de geração.
- `pipex_pagamentos` — quanto de cada pagamento vai pra cada competência (um Pix pode cobrir mais de um mês); `movimento_id` liga ao extrato bancário.
- Views `pipex_v_apuracao` (situação: `rateio` · `fora_rateio` · `nao_compensou` · `fora_carteira`) e `pipex_v_competencias` (devido · pago · saldo · previsto). Ambas `security_invoker`.
- RPCs: `pipex_importar_extrato` · `pipex_fechar` · `pipex_reabrir` · `pipex_projecao`.

## Fluxo do mês
1. **Apuração › Importar extrato (.xls)** — o .xls do portal é HTML em ISO-8859-1. Colunas: 0 mês/ano · 1–2 período · 5 tipo · 7 apólice · 8 cobertura · 9 segurado · 13 data geração · 14 mês pago até (parcela) · 15 prêmio líquido · 16 % · 19 comissão direta · 20 dt. emissão.
2. Prévia cruza com o acordo: no rateio / fora do rateio (0%) / não compensou / fora da carteira (marcar = adicionar ao acordo a partir da competência).
3. **Gravar** → `pipex_importar_extrato`. **Bloqueia** (rollback) se a soma das linhas ≠ total do arquivo, se o banco não ficar com exatamente as linhas/total do arquivo (chave repetida ou arquivo diferente do já importado) ou se a competência estiver fechada e vier linha nova. Reimportar o mesmo arquivo = 0 linhas novas.
4. **Fechar** → `pipex_fechar`: congela o devido, cria/atualiza o previsto `Comissão LP Daniel · Mmm/aa` (tipo receber, visão PIPEX, venc. dia 05, mesma conta dos meses anteriores) e atualiza a base da projeção.
5. **A receber › ＋ Pagamento** — aloca o Pix (ou valor sem Pix) na competência; quitou → previsto vira `recebido` (e ganha o vínculo com o movimento quando um único Pix pagou).
6. **Prestação de contas** — documento pro Daniel; "Exportar PDF" = imprimir → Salvar como PDF.
7. **Projeção** — cenário por cliente: Daniel (0%) · Divide (%) · Cheio (100%), fluxo mês a mês.

## Decisões registradas
- **28/09 — sem ajuste de conciliação Abr–Ago/26.** Nada de crédito/débito retroativo. O que faltava de comprovante ficou como pagamento com observação "sem comprovante — decisão 28/09".
- **30/09 — Set/26 fica "a receber" até o Pix cair** (não marcar recebido antes do dinheiro entrar).
- Abr/26 fechado no valor do histórico da parceria (diferença de 1 centavo do comprovante, sem ajuste).
- Histórico Abr–Ago/26 veio da Central de 01/09 (extratos PDF consolidados **por apólice**, `fonte = historico`); a partir de Set/26, linhas reais do .xls.

## Legado (não escrever mais)
- `pipex_state` — snapshot de 01/09; backup, o app não lê mais.
- `lp_comissao_meses` / `lp_comissao_itens` e a tela **Comissões LP** — congeladas (fora do menu). `lp_carteira` segue como cadastro do livro inteiro do Daniel (override MFB).

## Como rodar (SQL Editor do Supabase)
1. `scripts/pipex_modulo.sql` (pode rodar de novo; mesmo estado).
2. Carga privada (fora do git) — acordo, %, histórico, pagamentos e Set/26.
3. `scripts/pipex_selftest.sql` — dados sintéticos, termina em rollback. Deve imprimir `pipex_selftest: OK`.

## Pendências
- Extrato C6 de jul/26 não importado em `movimentos` (Pix que pagou Mai + parte de Jun).
- Mesmo módulo no CRM ("Parceiros") deve usar a mesma regra e bater os mesmos números.
