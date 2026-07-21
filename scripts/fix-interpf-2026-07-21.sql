-- ============================================================
-- Central Financeira · Inter PF (JUCA) — reconciliação com o extrato
-- Fonte: Extrato-01-01-2026-a-21-07-2026-PDF.pdf (Banco Inter, conta 26840704-5)
-- Gerado em 2026-07-21. Conta destino: 8249d7a2-df4f-430b-937c-a9bcdf87142a
-- 324 transações no extrato | cadeia de saldo validada 100% (fecha em R$ 351,03)
-- ============================================================
begin;

-- ------------------------------------------------------------
-- 1) DUPLICATAS: 16 movimentos de 22–28/06 entraram 2x
--    (carga manual 'load20260629_*' + sync 'pluggy_*').
--    Mantém a linha do Pluggy (hash casa com syncs futuros) e,
--    antes de apagar, herda a categoria da linha manual.
-- ------------------------------------------------------------
update movimentos p set categoria_id = l.categoria_id
  from movimentos l
 where p.conta_id = '8249d7a2-df4f-430b-937c-a9bcdf87142a'
   and l.conta_id = p.conta_id
   and p.hash like 'pluggy_%' and l.hash like 'load20260629_%'
   and p.data = l.data and p.valor = l.valor and p.sinal = l.sinal
   and p.data between '2026-06-22' and '2026-06-28'
   and p.categoria_id is null and l.categoria_id is not null;

delete from movimentos l
 where l.conta_id = '8249d7a2-df4f-430b-937c-a9bcdf87142a'
   and l.hash like 'load20260629_%'
   and l.data between '2026-06-22' and '2026-06-28'
   and exists (select 1 from movimentos p
                where p.conta_id = l.conta_id and p.hash like 'pluggy_%'
                  and p.data = l.data and p.valor = l.valor and p.sinal = l.sinal);
-- esperado: 16 linhas

-- ------------------------------------------------------------
-- 2) PLUG DE SALDO INICIAL: a linha sintética de 30/03 (R$ 319,82)
--    existia só porque não havia histórico antes de 31/03.
--    Agora o histórico real de 01/01 a 30/03 entra abaixo -> ela vira double-count.
-- ------------------------------------------------------------
delete from movimentos
 where conta_id = '8249d7a2-df4f-430b-937c-a9bcdf87142a'
   and hash = 'saldoini_interpf_20260330';
-- esperado: 1 linha

-- ------------------------------------------------------------
-- 3) HISTÓRICO FALTANDO: 151 movimentos de 02/01 a 30/03 + 3 de 17/07.
--    Idempotente (hash único por linha; roda 2x sem duplicar).
--    categoria_id fica null de propósito -> rodar "Auto-categorizar" no app.
-- ------------------------------------------------------------
insert into movimentos (conta_id, data, descricao_original, descricao_limpa, valor, sinal, categoria_id, visao, hash, fonte)
select v.conta_id::uuid, v.data::date, v.descricao, v.descricao, v.valor::numeric, v.sinal::int, null, 'JUCA'::visao, v.hash, 'extrato_pdf'
  from (values
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-02','Debito BM&F: "TAXA DE PERMANENCIA"',0.72,-1,'extpdf20260721_001'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-03','Pagamento efetuado: "Pagamento fatura cartao Inter"',2747.66,-1,'extpdf20260721_002'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-03','Pix recebido: "Cp :18236120-Gustavo Melo Juca"',800.00,1,'extpdf20260721_003'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-03','Pix recebido: "Cp :18236120-Gustavo Melo Juca"',2000.00,1,'extpdf20260721_004'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-08','Pix enviado: "Cp :10573521-Nildeval Marinho Gouveia Junior"',41.03,-1,'extpdf20260721_005'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-09','Pix enviado devolvido: "Cp :14796606-UBER DO BRASIL TECNOLOGIA LTDA"',0.01,1,'extpdf20260721_006'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-09','Pix enviado: "Cp :14796606-UBER DO BRASIL TECNOLOGIA LTDA"',49.49,-1,'extpdf20260721_007'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-09','Pix enviado: "Cp :01027058-NOSSO GRANEL ALIMENTOS SAUDAVEIS"',47.85,-1,'extpdf20260721_008'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-12','Pagamento efetuado: "Pagamento fatura cartao Inter"',733.29,-1,'extpdf20260721_009'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-12','Pix recebido: "Cp :60746948-GUSTAVO MELO JUCA"',869.44,1,'extpdf20260721_010'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-14','Pagamento efetuado: "Pagamento fatura cartao Inter"',2602.86,-1,'extpdf20260721_011'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-14','Resgate: "CDB Porq Obj BANCO INTER S A"',605.00,1,'extpdf20260721_012'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-14','Resgate: "CDB Porq Obj BANCO INTER S A"',978.78,1,'extpdf20260721_013'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-14','Resgate: "CDB Porq Obj BANCO INTER S A"',1021.22,1,'extpdf20260721_014'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-15','Pix enviado: "Cp :03732359-POSTO CONCORDE"',12.98,-1,'extpdf20260721_015'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-16','Pix enviado: "Cp :31872495-LAYOUT ARTES GRAFICAS LTDA"',2.00,-1,'extpdf20260721_016'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-16','Pix enviado: "Cp :10573521-Antonio Pilar Goes"',40.00,-1,'extpdf20260721_017'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-20','Pix enviado: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',1600.00,-1,'extpdf20260721_018'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-20','Resgate: "CDB Porq Obj BANCO INTER S A"',459.44,1,'extpdf20260721_019'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-20','Resgate: "CDB Porq Obj BANCO INTER S A"',1018.59,1,'extpdf20260721_020'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-20','Resgate: "CDB Porq Obj BANCO INTER S A"',21.97,1,'extpdf20260721_021'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-23','Pix enviado: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',500.00,-1,'extpdf20260721_022'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-23','Resgate: "CDB Porq Obj BANCO INTER S A"',995.71,1,'extpdf20260721_023'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-23','Resgate: "CDB Porq Obj BANCO INTER S A"',4.29,1,'extpdf20260721_024'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-24','Pagamento efetuado: "Pagamento fatura cartao Inter"',500.00,-1,'extpdf20260721_025'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-25','Pagamento efetuado: "Pagamento fatura cartao Inter"',300.00,-1,'extpdf20260721_026'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-25','IOF: "08427"',2.98,-1,'extpdf20260721_027'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-25','Deposito: "08423"',85.26,-1,'extpdf20260721_028'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-25','Resgate: "CDB Porq Obj BANCO INTER S A"',466.00,1,'extpdf20260721_029'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-25','IOF: "08427"',2.71,-1,'extpdf20260721_030'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-25','Deposito: "08423"',77.29,-1,'extpdf20260721_031'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-26','Pagamento efetuado: "Pagamento fatura cartao Inter"',556.40,-1,'extpdf20260721_032'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-26','Pix recebido: "Cp :00360305-GUSTAVO MELO JUCA"',556.40,1,'extpdf20260721_033'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-28','Pagamento efetuado: "Pagamento fatura cartao Inter"',50.00,-1,'extpdf20260721_034'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-01-29','Pagamento efetuado: "Pagamento fatura cartao Inter"',30.00,-1,'extpdf20260721_035'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-02','Pagamento efetuado: "Pagamento fatura cartao Inter"',2897.99,-1,'extpdf20260721_036'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-02','Pix recebido: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',3000.00,1,'extpdf20260721_037'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-02','Debito BM&F: "TAXA DE PERMANENCIA"',0.38,-1,'extpdf20260721_038'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-08','Pix recebido: "Cp :01896779-AOCAMPOS CORRETAGEM DE SEGUROS LTDA"',764.27,1,'extpdf20260721_039'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-09','Pix recebido: "Cp :60701190-MARIA EDUARDA GALVAO CORREIA"',2098.05,1,'extpdf20260721_040'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-10','Pagamento efetuado: "Pagamento fatura cartao Inter"',796.75,-1,'extpdf20260721_041'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-12','Pix enviado: "Cp :00360305-Jorge Abdon de Lima"',15.00,-1,'extpdf20260721_042'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-12','Compra no debito: "No estabelecimento DUTY PAID GIG 3 RIO DE JANEIR BRA"',44.99,-1,'extpdf20260721_043'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-13','Pix enviado: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',900.00,-1,'extpdf20260721_044'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-13','Pagamento efetuado: "Pagamento fatura cartao Inter"',1000.00,-1,'extpdf20260721_045'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-18','Pix enviado: "Cp :90400888-Fernando Antonio de Oliveira Andrade Filho"',528.12,-1,'extpdf20260721_046'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-18','Resgate: "CDB Porq Obj BANCO INTER SA"',543.07,1,'extpdf20260721_047'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-19','Pix recebido: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',1000.00,1,'extpdf20260721_048'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-19','Pagamento efetuado: "Pagamento fatura cartao Inter"',180.00,-1,'extpdf20260721_049'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-19','Pix enviado: "Cp :60701190-AUSTRALIA BURGUERES COMERCIAL DE ALIMENTOS LTDA"',37.89,-1,'extpdf20260721_050'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-20','Pix enviado: "Cp :00360305-Maria Gabriela Mergulhao Calado"',279.48,-1,'extpdf20260721_051'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-20','Pagamento efetuado: "Pagamento fatura cartao Inter"',400.00,-1,'extpdf20260721_052'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-20','Credito Resgate Fundo: "INTER INST FINANCEIRAS FIRF CP"',1017.32,1,'extpdf20260721_053'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-20','Pix enviado: "Cp :00000000-SUL STORE"',14.25,-1,'extpdf20260721_054'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-20','Pix enviado: "00019 286037874 JOAO MELO"',253.87,-1,'extpdf20260721_055'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-20','Pix enviado: "Cp :60746948-Marcela Moreira Loyo"',280.68,-1,'extpdf20260721_056'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-21','Pix enviado: "Cp :18236120-Orlando Cabral de Melo"',14.25,-1,'extpdf20260721_057'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-22','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',21.73,-1,'extpdf20260721_058'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-23','Pix enviado: "Cp :60701190-LEM LOJAS DE CONVENIENCIA II"',22.24,-1,'extpdf20260721_059'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-24','Pix enviado: "Cp :18236120-Antonio Severino Cardoso"',20.25,-1,'extpdf20260721_060'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-24','Pix enviado: "Cp :16501555-PADARIA ROSA BRANCA"',6.00,-1,'extpdf20260721_061'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-25','Pagamento efetuado: "Pagamento fatura cartao Inter"',500.00,-1,'extpdf20260721_062'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-25','Pix enviado: "Cp :60701190-ADP COMERCIO E SERVICOS LTDA"',14.00,-1,'extpdf20260721_063'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-26','Pix enviado: "Cp :10573521-Abraao Moura de Freitas"',46.00,-1,'extpdf20260721_064'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-27','Pix enviado: "Cp :18236120-Antonio Severino Cardoso"',14.25,-1,'extpdf20260721_065'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-27','Pagamento efetuado: "Pagamento fatura cartao Inter"',3105.91,-1,'extpdf20260721_066'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-27','Pix recebido: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',3500.00,1,'extpdf20260721_067'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-02-28','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',43.60,-1,'extpdf20260721_068'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-01','Pix recebido: "Cp :60746948-GUSTAVO MELO JUCA"',131.00,1,'extpdf20260721_069'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-01','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_070'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-02','Pix recebido: "Cp :01896779-OUTLIERS CORRETORA DE SEGUROS LTDA"',3914.67,1,'extpdf20260721_071'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-02','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',17.70,-1,'extpdf20260721_072'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-02','Debito BM&F: "TAXA DE PERMANENCIA"',0.38,-1,'extpdf20260721_073'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-03','Pix recebido: "Cp :18236120-Victor Figueiredo da Silva"',6000.00,1,'extpdf20260721_074'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-03','Pix recebido: "Cp :18236120-Victor Figueiredo da Silva"',6000.00,1,'extpdf20260721_075'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-03','Pix recebido: "Cp :18236120-Victor Figueiredo da Silva"',4000.00,1,'extpdf20260721_076'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-03','Pix enviado: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',1500.00,-1,'extpdf20260721_077'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-03','Pix recebido: "Cp :60701190-DANIEL COSTA C SOUZA CRUZ"',325.00,1,'extpdf20260721_078'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-03','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_079'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-04','Pix enviado: "Cp :18236120-Gustavo Melo Juca"',10000.00,-1,'extpdf20260721_080'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-04','Compra no debito: "No estabelecimento DEGUTTI RECIFE BRA"',38.94,-1,'extpdf20260721_081'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-04','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_082'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-05','Pix enviado: "Cp :18189547-57243527 RAYANA GABRIELLA DALZY DE ALMEIDA"',12.69,-1,'extpdf20260721_083'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-07','Pix enviado: "Cp :60746948-WELLINGTON DE LIMA LTDA"',4.50,-1,'extpdf20260721_084'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-07','Pix enviado: "Cp :60746948-WELLINGTON DE LIMA LTDA"',14.25,-1,'extpdf20260721_085'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-07','Pix recebido: "Cp :60746948-ARTHUR DE OLIVEIRA CAMPOS"',864.87,1,'extpdf20260721_086'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-08','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_087'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-09','Pix enviado: "00019 150164564 GIVANILDO ANDRADE"',20.25,-1,'extpdf20260721_088'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-10','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_089'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-10','Cashback: "Tim-PE R$ 60,00 - e861d3d4-af78-4c63-87e8-052ac4e6aa89"',3.00,1,'extpdf20260721_090'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-10','Pix enviado: "Cp :90400888-Jose Carlos Pilar Goes"',43.00,-1,'extpdf20260721_091'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-11','Pagamento efetuado: "Pagamento fatura cartao Inter"',1460.31,-1,'extpdf20260721_092'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-11','Pix enviado: "Cp :18236120-Gustavo Melo Juca"',7000.00,-1,'extpdf20260721_093'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-11','Pix enviado: "Cp :14796606-UBER DO BRASIL TECNOLOGIA LTDA"',200.00,-1,'extpdf20260721_094'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-11','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_095'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-12','Pix enviado: "Cp :00000000-SUL STORE"',14.25,-1,'extpdf20260721_096'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-13','Pix enviado: "Cp :10573521-Manasses Antonio Do Nascimento"',42.00,-1,'extpdf20260721_097'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-15','Pix enviado: "Cp :18236120-Gustavo Melo Juca"',500.00,-1,'extpdf20260721_098'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-16','Pix enviado: "Cp :03732359-POSTO CONCORDE"',17.24,-1,'extpdf20260721_099'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-17','Pix recebido: "00019 220507546 CINQ FINANCE TREINAMENTO E SOLUCOES"',49.90,1,'extpdf20260721_100'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-17','Pix enviado: "Cp :60746948-MULTIFOOD AMPM"',15.50,-1,'extpdf20260721_101'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-17','Pix enviado: "Cp :08561701-Jose Claudio da Silva"',35.00,-1,'extpdf20260721_102'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-18','Pix recebido: "Cp :00360305-GUSTAVO MELO JUCA"',2079.00,1,'extpdf20260721_103'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-18','Pix enviado: "Cp :00360305-Elandia Leite de Andrade Mendonca"',45.00,-1,'extpdf20260721_104'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-18','Pix enviado: "Cp :18236120-Elandia Leite de Andrade Mendonca"',28.00,-1,'extpdf20260721_105'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-18','Pagamento efetuado: "Pagamento fatura cartao Inter"',500.00,-1,'extpdf20260721_106'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-19','Pix enviado: "Cp :90400888-Jose Carlos Pilar Goes"',40.00,-1,'extpdf20260721_107'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-20','Pagamento efetuado: "Pagamento fatura cartao Inter"',65.00,-1,'extpdf20260721_108'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-20','Pagamento efetuado: "Pagamento fatura cartao Inter"',100.00,-1,'extpdf20260721_109'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-24','Pagamento efetuado: "Pagamento fatura cartao Inter"',100.00,-1,'extpdf20260721_110'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-24','Pix enviado: "00019 130629901 LEANDRO RIBEIRO"',300.00,-1,'extpdf20260721_111'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-24','Pagamento efetuado: "Pagamento fatura cartao Inter"',100.00,-1,'extpdf20260721_112'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-24','Pix enviado: "Cp :00000000-SUL STORE"',11.75,-1,'extpdf20260721_113'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pagamento efetuado: "Pagamento fatura cartao Inter"',223.57,-1,'extpdf20260721_114'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pix enviado: "Cp :60746948-Marcela Moreira Loyo"',280.68,-1,'extpdf20260721_115'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pix enviado: "Cp :90400888-Fernando Antonio de Oliveira Andrade Filho"',257.15,-1,'extpdf20260721_116'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pix recebido: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',600.00,1,'extpdf20260721_117'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pagamento efetuado: "Pagamento fatura cartao Inter"',200.00,-1,'extpdf20260721_118'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pix enviado: "Cp :00000000-SUL STORE"',11.75,-1,'extpdf20260721_119'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pagamento Esocial: "DOCUMENTO DE ARRECADACAO DO ESOCIAL"',504.04,-1,'extpdf20260721_120'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-25','Pagamento Esocial: "DOCUMENTO DE ARRECADACAO DO ESOCIAL"',563.35,-1,'extpdf20260721_121'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-26','Pix recebido: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',200.00,1,'extpdf20260721_122'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-26','Pix enviado: "Cp :18236120-Orlando Cabral de Melo"',14.25,-1,'extpdf20260721_123'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pagamento efetuado: "Pagamento fatura cartao Inter"',136.00,-1,'extpdf20260721_124'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Credito Conta Global De Inv: "08832"',93.10,1,'extpdf20260721_125'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Debito Iof Conta Global De Inv: "08901"',0.35,-1,'extpdf20260721_126'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','IOF: "08427"',0.59,-1,'extpdf20260721_127'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Resgate: "08425"',155.57,1,'extpdf20260721_128'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pagamento efetuado: "Pagamento fatura cartao Inter"',300.00,-1,'extpdf20260721_129'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pix recebido: "Cp :60746948-GUSTAVO MELO JUCA"',37.35,1,'extpdf20260721_130'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pix recebido: "00019 482783354 OUTLIERS CORRETORA DE SEGUROS LTDA"',240.00,1,'extpdf20260721_131'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pagamento efetuado: "Pagamento fatura cartao Inter"',200.00,-1,'extpdf20260721_132'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pix enviado: "Cp :10573521-Edson Firmino Dantas"',48.00,-1,'extpdf20260721_133'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-27','Pix enviado: "Cp :00000000-SUL STORE"',11.75,-1,'extpdf20260721_134'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-28','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_135'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Cred Pontos Cashback Conta: "Resgate Pontos"',187.50,1,'extpdf20260721_136'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :01027058-J H CACAU SHOW"',16.96,-1,'extpdf20260721_137'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :60746948-ATACADO DOS PRESENTES"',78.59,-1,'extpdf20260721_138'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :60746948-RECIFE PARKING LTDA"',15.50,-1,'extpdf20260721_139'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :90400888-GAME STATION"',80.00,-1,'extpdf20260721_140'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :90400888-GAME STATION"',80.00,-1,'extpdf20260721_141'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :18236120-Gustavo Melo Juca"',100.00,-1,'extpdf20260721_142'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix recebido: "Cp :00000000-GUSTAVO MELO JUCA"',681.21,1,'extpdf20260721_143'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-29','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',14.00,-1,'extpdf20260721_144'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Pix enviado: "Cp :60701190-MAURO JOSE DA SILVA"',43.00,-1,'extpdf20260721_145'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Pix enviado: "Cp :08561701-Sergivaldo Antonio de Barros Queiroz"',40.00,-1,'extpdf20260721_146'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Pagamento efetuado: "Pagamento fatura cartao Inter"',200.00,-1,'extpdf20260721_147'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Pix enviado: "Cp :60746948-DEGUTTI"',31.46,-1,'extpdf20260721_148'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Pix enviado: "Cp :01027058-CACAU SHOW SETUBAL"',17.99,-1,'extpdf20260721_149'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Credito Resgate Fundo: "INTER CONSERVADOR PLUS FIRF LP"',102.74,1,'extpdf20260721_150'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-03-30','Pix enviado: "Cp :03732359-MULTIPOSTOS"',41.22,-1,'extpdf20260721_151'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-07-17','Pix recebido: "00019 220507546 CINQ FINANCE TREINAMENTO E SOLUCOES"',98.65,1,'extpdf20260721_152'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-07-17','Pagamento efetuado: "Pagamento fatura cartao Inter"',159.00,-1,'extpdf20260721_153'),
    ('8249d7a2-df4f-430b-937c-a9bcdf87142a','2026-07-17','Pix enviado: "Cp :60701190-ALEM DO PAO DELICATESSEN"',17.05,-1,'extpdf20260721_154')
  ) as v(conta_id, data, descricao, valor, sinal, hash)
 where not exists (select 1 from movimentos m where m.hash = v.hash);
-- esperado: 154 linhas

-- ------------------------------------------------------------
-- 4) SALDO DA CONTA: extrato de 21/07 13h28 fecha em R$ 351,03
--    (estava 428,43 = saldo de 15/07, defasado).
-- ------------------------------------------------------------
update contas set saldo_atual = 351.03
 where id = '8249d7a2-df4f-430b-937c-a9bcdf87142a';

commit;

-- ============================================================
-- CONFERÊNCIA (rode depois; tem que bater com o extrato)
-- ============================================================
-- total de movimentos e soma por mês:
select to_char(data,'YYYY-MM') as mes, count(*) as n,
       sum(case when sinal>0 then valor else 0 end)  as entradas,
       sum(case when sinal<0 then valor else 0 end)  as saidas
  from movimentos
 where conta_id = '8249d7a2-df4f-430b-937c-a9bcdf87142a'
 group by 1 order by 1;
-- esperado: 01=35 | 02=33 | 03=89 | 04=78 | 05=26 | 06=31 | 07=32  (324 no total)

-- duplicata residual (tem que voltar vazio):
select data, valor, sinal, count(*)
  from movimentos where conta_id = '8249d7a2-df4f-430b-937c-a9bcdf87142a'
 group by 1,2,3 having count(*) > 2;
