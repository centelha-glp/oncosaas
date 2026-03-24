# Termo de Compromisso de Utilizacao de Dados (TCUD)

---

**UNIVERSIDADE FEDERAL DO ESPIRITO SANTO — UFES**
**HOSPITAL UNIVERSITARIO CASSIANO ANTONIO MORAES — HUCAM**
**Empresa Brasileira de Servicos Hospitalares — EBSERH**

---

## TERMO DE COMPROMISSO DE UTILIZACAO DE DADOS

Eu, **[PREENCHER — nome completo do pesquisador principal]**, portador(a) do CPF **[PREENCHER]**, pesquisador(a) responsavel pelo projeto de pesquisa intitulado:

**"OncoNav: Plataforma de Navegacao Oncologica com Inteligencia Artificial para Pacientes com Cancer de Bexiga — Estudo de Viabilidade e Validacao Clinica"**

comprometo-me, perante o Comite de Etica em Pesquisa do HUCAM/UFES, a cumprir os termos abaixo relacionados quanto a utilizacao dos dados coletados nesta pesquisa.

---

### 1. Finalidade de Uso

Os dados coletados durante a execucao deste projeto serao utilizados **exclusivamente** para os fins descritos no protocolo de pesquisa aprovado pelo CEP, a saber:

- Avaliacao da viabilidade e aceitabilidade da plataforma OncoNav;
- Validacao do algoritmo de priorizacao clinica baseado em inteligencia artificial;
- Analise de desfechos clinicos e de navegacao oncologica;
- Producao de artigos cientificos, dissertacoes, teses e apresentacoes em eventos academicos.

Qualquer utilizacao dos dados para finalidade diversa da aqui descrita somente sera realizada mediante nova submissao e aprovacao pelo CEP.

---

### 2. Pseudoanonimizacao e Protecao de Identidade

- Todos os dados utilizados em analises, datasets de treinamento de modelos de IA e relatorios serao **pseudoanonimizados**: cada participante sera identificado por um codigo numerico sequencial (ID), sem vinculacao a nome, CPF, endereco ou qualquer informacao diretamente identificavel.
- A tabela de correspondencia entre o ID numerico e a identidade do participante sera armazenada em ambiente separado, com acesso restrito exclusivamente ao pesquisador principal.
- Em nenhuma publicacao, apresentacao ou relatorio sera possivel identificar individualmente os participantes.

---

### 3. Conformidade com a LGPD (Lei 13.709/18)

O tratamento dos dados pessoais e sensiveis dos participantes observara integralmente a Lei Geral de Protecao de Dados Pessoais, conforme detalhado a seguir:

#### 3.1 Bases Legais

- **Consentimento explicito (Art. 7, inciso I)**: o participante fornecera consentimento livre, esclarecido e inequivoco por meio do Termo de Consentimento Livre e Esclarecido (TCLE), podendo revoga-lo a qualquer momento.
- **Pesquisa cientifica (Art. 7, inciso IV)**: os dados serao tratados para a realizacao de estudos por orgao de pesquisa, garantida, sempre que possivel, a anonimizacao dos dados pessoais.

#### 3.2 Dados Pessoais Sensiveis

- Os dados de saude coletados nesta pesquisa sao classificados como **dados pessoais sensiveis** nos termos do Art. 5, inciso II, da LGPD.
- O tratamento sera realizado com base no **consentimento especifico e destacado** do titular (Art. 11, inciso I), conforme previsto no TCLE.
- Serao coletados apenas os dados estritamente necessarios para os objetivos da pesquisa (principio da necessidade, Art. 6, inciso III).

#### 3.3 Direitos do Titular

Os participantes terao garantidos todos os direitos previstos no Art. 18 da LGPD, incluindo:

- **Acesso** aos dados pessoais tratados (Art. 18, II);
- **Correcao** de dados incompletos, inexatos ou desatualizados (Art. 18, III);
- **Anonimizacao, bloqueio ou eliminacao** de dados desnecessarios ou excessivos (Art. 18, IV);
- **Eliminacao** dos dados pessoais tratados com consentimento (Art. 18, VI);
- **Revogacao do consentimento** a qualquer momento, sem onus (Art. 18, IX).

Para exercicio desses direitos, o participante podera entrar em contato com o pesquisador principal pelos canais informados no TCLE.

---

### 4. Armazenamento Seguro

- Os dados serao armazenados em banco de dados PostgreSQL hospedado em servidores cloud (AWS/GCP), com **criptografia em repouso (AES-256)** e **em transito (TLS 1.3)**.
- O acesso ao banco de dados sera restrito por credenciais individuais, com autenticacao multi-fator e registro de auditoria (logs de acesso).
- A plataforma utiliza arquitetura **multi-tenant** com isolamento logico de dados por instituicao.
- Backups automaticos serao realizados diariamente, com armazenamento geograficamente redundante.

---

### 5. Prazo de Retencao

- Os dados da pesquisa serao mantidos pelo prazo de **5 (cinco) anos** apos a publicacao dos resultados finais, em conformidade com a Resolucao CNS 466/12 (item IV.3.g) e com as boas praticas de pesquisa cientifica.
- Durante o periodo de retencao, os dados permanecerao armazenados nas mesmas condicoes de seguranca descritas no item 4.

---

### 6. Plano de Descarte

- Apos o prazo de retencao de 5 anos, todos os dados pessoais e sensiveis serao **eliminados de forma segura e irreversivel**:
  - Dados em banco de dados: exclusao logica seguida de sobrescrita fisica (wipe) dos registros;
  - Backups: eliminacao de todas as copias de seguranca que contenham dados dos participantes;
  - Datasets de treinamento de IA: exclusao de quaisquer datasets que contenham dados pseudoanonimizados;
  - Tabela de correspondencia (ID-identidade): destruicao permanente.
- A eliminacao sera documentada em relatorio de descarte, que sera mantido como comprovacao.

---

### 7. Compartilhamento de Dados

- Os dados individuais dos participantes **nao serao compartilhados** com terceiros, empresas ou instituicoes nao envolvidas na pesquisa.
- Os resultados serao divulgados apenas de forma **agregada e anonimizada**, em publicacoes cientificas e apresentacoes academicas.

---

Vitoria/ES, [PREENCHER — dia] de [PREENCHER — mes] de [PREENCHER — ano].

---

**Pesquisador(a) Principal:**

**Nome:** [PREENCHER — nome completo]

**Instituicao:** HUCAM/UFES/EBSERH

**E-mail:** [PREENCHER]

**Telefone:** [PREENCHER]

**Assinatura:** _______________________________________________

---

*Documento gerado para fins de submissao ao Comite de Etica em Pesquisa e a Plataforma Brasil.*
