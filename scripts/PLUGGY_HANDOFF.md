# Handoff — Integração Pluggy (Central Financeira)

Cole o bloco abaixo como primeira mensagem da próxima sessão.

---

## PROMPT PARA A PRÓXIMA SESSÃO

Contexto: repo `juca-alt/central-financeira` (app financeiro pessoal, Supabase
projeto `mieqsiojvfiqrhectquc`). Branch de trabalho: `claude/pluggy-integration-hwpdnz`
(já mergeada na `main`). Estou migrando o CRM pra outra base/org em sessão separada —
NÃO toque em nada de CRM; trabalhe só no central-financeira.

### O que já está PRONTO e no ar
- Sincronia bancária gratuita via **Meu Pluggy** (meu.pluggy.ai) rodando.
- **Inter PF** (visão JUCA) e **Nubank Família** (visão FAMILIA) sincronizando.
- Mergeado na `main`; **cron diário ativo às 06h40 BRT** (`.github/workflows/sync-pluggy.yml`).
- Secrets `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` cadastrados no GitHub Actions.
- App de produção (`app.js`/`index.html`) intacto — só o pipeline de sync foi adicionado.

### Mapeamentos gravados (`pluggy_conexoes`)
- Inter PF: item `4fbebc8b-f917-492c-9168-549953318ff6` → conta `8249d7a2-df4f-430b-937c-a9bcdf87142a`, account `e5b3b338-9788-4b7d-b181-be5e986f5dfd`, visão JUCA.
- Nubank: item `5c04d080-ae92-42fd-93b2-f91fe9d1130f` → conta `9225d426-84a9-4b0b-a28b-d5fc23a3600d`, account `92462b64-35db-49d5-8ca4-227c9dd6a307`, visão FAMILIA.

### Como operar o sync (workflow `sync-pluggy.yml`, dispatch manual)
Inputs: `dry_run`, `discover`, `item_ids`, `mapping` (JSON), `sync_days`, `probe_days`.
- DISCOVER + `item_ids`: lista accounts/saldos de um item + contas do app.
- `mapping=[{item_id,conta_id,visao,banco,account_id}]`: grava de-para e sai.
- `probe_days=N`: lista movimentos recentes do app (read-only) — usar pra checar sobreposição antes de sincronizar item novo.
- Verificar runs: usar mcp__github__actions_list (list_workflow_runs → jobs) + get_job_logs. O list_workflow_runs estoura o limite de tokens; salvar em arquivo e ler com python.

### Pendências
1. **C6 (visão PIPEX)**: deixado de fora. Decidir com o usuário PF ou PJ.
   - PF: tentar conectar via MeuPluggy na Demo (dashboard.pluggy.ai/applications/f5941584-91d3-4632-9423-b2c2e47ed5d6/demo) e mapear.
   - PJ: MeuPluggy é PF-only → plano B = import OFX/CSV (molde do sync Nubank por e-mail). Contas C6 no app: `39da6c60-...` (C6 PF) e `adf5afca-...` (C6 PJ), ambas PIPEX.
2. **Verificar o 1º disparo do cron** (amanhã 06h40 BRT / 09h40 UTC): conferir run schedule verde.
3. Opcional: sincronizar histórico mais antigo do Nubank/Inter (hoje começou em 22/06 pra Nubank por causa do corte do Organizze em 21/06).

### Aprendizados/guardrails (não repetir os erros)
- Item MeuPluggy **não aceita PATCH /items** (refresh forçado → 400 "cant be updated"); o script trata como aviso e segue lendo o dado diário. Normal.
- Transações: usar **GET /v2/transactions** com `accountId` + `dateFrom` + cursor `after`. NÃO mandar `from`/`pageSize` (400 "should not exist"); v1 por página está morto (410).
- Pluggy **não deixa listar itens** pela API (segurança) — pegar item_id sempre pela tela Demo (print funciona).
- **Anti-duplicata**: dedup é por hash e fontes diferentes (organizze:/nu_/pluggy_) NÃO se cruzam. Antes de ligar um item novo numa conta que já tem histórico, rodar PROBE e começar a janela do Pluggy DEPOIS da última data da fonte antiga. Organizze e sync-nubank-email estão com cron desligado (sem risco de competir).
- Na Demo, conectar SEMPRE pelo conector **MeuPluggy** (não pelo banco direto — conta de teste bloqueia banco real). Conector precisa estar ativo em Customização → Conectores.

### Autonomia
Usuário quer execução autônoma máxima (nível 3). Confirmar só ações destrutivas
(ex.: push em `main`, desativar sync existente). Ele informa senhas/dados sensíveis
por print quando necessário — nunca pedir CLIENT_SECRET no chat.
