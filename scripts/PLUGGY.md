# Pluggy grátis via Meu Pluggy — guia de ativação (Fase B)

O pipeline de ingestão já está pronto no repo (commit "Pluggy: pipeline de
ingestão pronto"). O que faltava era a incógnita do trial pago. A rota
**Meu Pluggy** (https://meu.pluggy.ai) resolve isso: é o produto gratuito da
Pluggy para uso pessoal. Você conecta seus bancos lá, e eles entram na sua
aplicação de desenvolvedor através do conector **MeuPluggy** — esses itens
**continuam funcionando depois que o trial de 15 dias acaba**, com dado
atualizado diariamente pelo lado da Pluggy.

Referências: [repo oficial meu-pluggy](https://github.com/pluggyai/meu-pluggy)
e o [guia do Actual Budget](https://actualbudget.org/docs/advanced/bank-sync/pluggyai/),
que usa exatamente essa rota.

## Passo a passo (fazer DENTRO dos 15 dias de trial)

### 1. Meu Pluggy — conectar os bancos
1. Crie a conta gratuita em https://meu.pluggy.ai (e-mail pessoal).
2. Conecte cada banco via Open Finance:
   - **Nubank** (visão FAMILIA)
   - **Inter PF** (visão JUCA)
   - **C6** (visão PIPEX)

### 2. Dashboard Pluggy — credenciais de desenvolvedor
1. Crie a conta em https://dashboard.pluggy.ai (inicia o trial de 15 dias).
2. Crie uma **Application** (tipo Development) → anote `CLIENT_ID` e
   `CLIENT_SECRET`.
3. Na aplicação, habilite o conector **MeuPluggy** na lista de conectores
   (Customization → Connectors), se ainda não estiver visível.
4. Cadastre os secrets na Edge Function do Supabase
   (Edge Functions → pluggy-connect-token → Secrets):
   `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`.

### 3. Ligar o Meu Pluggy à aplicação (1 vez POR BANCO)
Duas opções — as duas geram os `item_id` que o sync usa:

- **Opção A (nossa página):** abra `scripts/pluggy-connect.html` no navegador,
  preencha a anon key, clique no botão do banco e escolha o conector
  **MeuPluggy** no widget. Faça o OAuth. Repita para cada banco (a Pluggy exige
  uma autorização por banco conectado no Meu Pluggy, não por conta). A página
  captura os `item_id` e gera o SQL de mapeamento.
- **Opção B (demo da Pluggy):** no dashboard, "Ir para Demo" → conectar via
  MeuPluggy → menu no canto superior direito → **Copiar Item ID**.

### 4. Mapear no Supabase
1. Rode `scripts/pluggy_conexoes.sql` uma vez no SQL Editor (cria a tabela).
2. Insira os mapeamentos `item_id → conta_id + visao` (a pluggy-connect.html
   gera o SQL pronto; falta só colar o `conta_id` da tabela `contas`).
3. Se um item tiver mais de um account (ex.: corrente + cartão), rode o
   workflow com `DISCOVER=true` para listar os `account_id` e fixe o certo na
   coluna `account_id` de `pluggy_conexoes`.

### 5. GitHub Actions — secrets e primeiro run
1. Cadastre em Settings → Secrets and variables → Actions:
   `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` (o `SUPABASE_SERVICE_KEY` já
   existe dos outros syncs).
2. Rode o workflow **Sync Pluggy** manualmente com `dry_run=true` e confira o
   log (transações certas, contas certas).
3. Rode com `dry_run=false` para gravar.
4. Descomente o bloco `schedule:` em `.github/workflows/sync-pluggy.yml` para
   ligar o cron diário (06h40 BRT).

## Pós-trial: o que muda
- Os itens MeuPluggy seguem ativos e a Pluggy atualiza o dado **1x por dia**.
- O `PATCH /items` (refresh forçado) pode passar a ser negado. O
  `sync-pluggy.mjs` já trata isso: loga o erro e segue lendo o dado diário —
  o run NÃO falha por causa disso.
- Se o consentimento Open Finance de algum banco vencer, reconecte o banco no
  https://meu.pluggy.ai (o item da aplicação volta a atualizar sozinho).
