# Conector de escrita v2 (mcp-financeiro 2.1)

O Claude edita a Central pelo conector e o app espelha. Acabou o "vira arquivo SQL pro Gustavo colar".

## Arquitetura (fonte unica)

```
Claude --MCP--> Edge mcp-financeiro (valida entrada) --RPC--> cf_<tool>(p_usuario, p_args, p_lote)
App (logado) ------------------------------------------RPC--> mesmas cf_* (identidade = JWT)
```

- A regra de negocio mora nas funcoes Postgres `cf_*` (SECURITY DEFINER). A Edge so valida e chama.
- `p_usuario` so vale para o service_role (conector) e o SQL Editor. Logado no app, vale o e-mail do JWT
  e o parametro e ignorado (ninguem se passa por outro).
- Permissao = `usuario_visoes` (escrever na visao). `dono` = token do dono (tudo). Camila herda so o que ela tem.
- **Nunca DELETE de dado financeiro.** "Apagar" = `cancelado`. DELETE segue sendo passo manual do Gustavo.
- **Toda escrita grava `cf_mcp_audit`** (1 linha por registro: antes/depois, usuario, tool, lote_id).
- Sem SQL livre pelo conector: so tools tipadas (o lote so aceita a lista abaixo).

## Tools novas

| Tool | O que faz |
|---|---|
| `editar_previsto` | Campos: descricao, valor, vencimento, categoria (nome), conta (nome), visao, observacao (anexa `\| dd/mm: ` por padrao), recorrencia (null = avulsa), competencia, entidade_id, status (so aberto/cancelado). Exige escrita na visao de origem e na de destino. |
| `cancelar_previsto` | status `cancelado` + motivo na observacao. Num recorrente, encerra a serie. |
| `lancar_conta_a_receber` | Espelho do `lancar_conta_a_pagar` com tipo `receber`. Categoria/conta inexistente = erro. |
| `dar_baixa` | Agora aceita **recorrente**: a ocorrencia atual vira avulsa quitada (`valor_real`) e nasce a proxima (vencimento + 1 periodo, `valor_proxima`). Com `movimento_id`, concilia nos dois lados. |
| `adiar_ocorrencia` | Recorrente: a atual vira avulsa na nova data e a serie segue no vencimento original + 1 periodo (nao duplica o mes). Avulsa: so muda a data. |
| `pular_ocorrencia` | Recorrente sem cobranca no periodo: a serie anda 1 periodo, nada pago e criado. |
| `conciliar` / `desconciliar` | Vinculo previsto <-> movimento nos dois lados. Status nao muda. Recusa vinculo conflitante. |
| `editar_movimento` | observacao, visao, categoria (nome). Valor/data/hash nao (data: `corrigir_data_movimento`). |
| `aplicar_tag` / `remover_tag` | Tag por nome em ate 500 movimentos. Idempotente. |
| `aplicar_lote` | Lista de chamadas as tools acima. **Tudo ou nada.** `dry_run=true` (padrao) devolve o diff sem gravar nada (nem auditoria); `dry_run=false` grava com um `lote_id`. |
| `desfazer` | Por `lote_id` ou `audit_id`: volta ao `antes`, do mais novo pro mais antigo; o que foi criado vira `cancelado`. Se o registro mudou depois, recusa sem reverter nada. O desfazer tambem e auditado. |
| `historico_alteracoes` | O que o conector mudou (so das visoes que a pessoa le). |

Periodos: semanal 7d, quinzenal 14d, mensal, bimestral, trimestral, semestral, anual.

## Arquivos

| Arquivo | Ticket |
|---|---|
| `t1-previstos.sql` | `cf_mcp_audit` + helpers + editar/cancelar previsto + conta a receber |
| `t2-recorrentes.sql` | dar_baixa recorrente + adiar + pular |
| `t3-movimentos.sql` | conciliar/desconciliar + editar_movimento + tags |
| `t4-lote-desfazer.sql` | aplicar_lote + desfazer + historico |
| `../../supabase/functions/mcp-financeiro/index.ts` | Edge 2.1.0 |
| `tests/` | replica local do schema, testes SQL (ROLLBACK) e e2e - ver `tests/README.md` |

## Deploy (ordem)

1. SQL Editor: rodar `t1` -> `t2` -> `t3` -> `t4`, **um arquivo por vez** (o editor so roda o topo de colagem grande).
   Todos sao idempotentes: rodar 2x nao muda nada (aceite 13).
2. Conferir: `select proname from pg_proc where proname like 'cf\_%' order by 1;` (33 funcoes).
3. Rodar o script de aceite com dados reais (fora do git), que termina em ROLLBACK.
4. Edge Functions -> `mcp-financeiro` -> colar `index.ts` -> Deploy, com **Verify JWT desligado**.
   (ou `supabase functions deploy mcp-financeiro --no-verify-jwt --project-ref <ref>`)
5. No Claude: `quem_sou_eu` deve listar as "Ferramentas de ESCRITA".
6. App v8.4.0 (aba "Alteracoes pelo Claude" + recarregar ao focar/puxar): merge na `main` depois do OK visual.
