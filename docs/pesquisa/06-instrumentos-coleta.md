# Instrumentos de Coleta de Dados

## Projeto: OncoNav — Plataforma Digital de Navegacao Oncologica com Inteligencia Artificial como Apoio a Decisao Clinica em Pacientes com Cancer de Bexiga

---

## Sumario dos Instrumentos

| N. | Instrumento | Publico-alvo | Aplicacao | Periodicidade |
|---|---|---|---|---|
| 1 | ESAS (Edmonton Symptom Assessment System) | Pacientes | WhatsApp / presencial | Semanal |
| 2 | PRO-CTCAE adaptado para cancer de bexiga | Pacientes | WhatsApp / presencial | A cada ciclo de tratamento |
| 3 | SUS (System Usability Scale) | Profissionais de saude | Online (formulario) | Uma vez (apos validacao tecnica) |
| 4 | Questionario de Satisfacao do Profissional de Saude | Profissionais de saude | Online (formulario) | Uma vez (apos periodo de uso) |

---

## Instrumento 1: ESAS (Edmonton Symptom Assessment System)

### Descricao

O ESAS e uma escala validada para avaliacao de sintomas em pacientes oncologicos, desenvolvida originalmente por Bruera et al. (1991). Consiste em 9 itens que avaliam a intensidade de sintomas comuns em pacientes com cancer, permitindo monitoramento longitudinal e identificacao precoce de sintomas que necessitam de intervencao.

**Referencia:** Bruera E, Kuehn N, Miller MJ, Selmser P, Macmillan K. The Edmonton Symptom Assessment System (ESAS): a simple method for the assessment of palliative care patients. J Palliat Care. 1991;7(2):6-9.

### Forma de Aplicacao

- **Via WhatsApp:** O agente conversacional do OncoNav envia os itens sequencialmente ao paciente, solicitando uma nota de 0 a 10 para cada sintoma. As respostas sao registradas automaticamente na plataforma.
- **Presencial:** Em consultas ambulatoriais, o instrumento pode ser aplicado pelo enfermeiro navegador em formato impresso ou digital (tablet).

### Periodicidade

- Aplicacao **semanal** durante todo o periodo de acompanhamento.
- Aplicacoes adicionais podem ser realizadas sob demanda clinica.

### Criterios de Alerta

- **Alerta individual:** qualquer item com pontuacao maior ou igual a 7 (sintoma intenso).
- **Alerta global:** soma total dos 9 itens maior ou igual a 50 (carga sintomatica elevada).
- Os alertas sao gerados automaticamente pela plataforma OncoNav e encaminhados ao enfermeiro navegador e ao medico responsavel.

### Itens e Escala de Resposta

Instrucao ao paciente: "Por favor, avalie a intensidade de cada sintoma nas ultimas 24 horas, sendo 0 = nenhum sintoma e 10 = pior sintoma possivel."

| N. | Sintoma | Escala |
|---|---|---|
| 1 | Dor | 0 (sem dor) -------- 10 (pior dor possivel) |
| 2 | Cansaco (fadiga) | 0 (sem cansaco) -------- 10 (pior cansaco possivel) |
| 3 | Nausea | 0 (sem nausea) -------- 10 (pior nausea possivel) |
| 4 | Depressao (tristeza) | 0 (sem depressao) -------- 10 (pior depressao possivel) |
| 5 | Ansiedade (nervosismo) | 0 (sem ansiedade) -------- 10 (pior ansiedade possivel) |
| 6 | Sonolencia | 0 (sem sonolencia) -------- 10 (pior sonolencia possivel) |
| 7 | Falta de apetite | 0 (apetite normal) -------- 10 (sem apetite nenhum) |
| 8 | Bem-estar geral | 0 (melhor bem-estar possivel) -------- 10 (pior bem-estar possivel) |
| 9 | Falta de ar (dispneia) | 0 (sem falta de ar) -------- 10 (pior falta de ar possivel) |

**Pontuacao total:** soma dos 9 itens (0-90).

---

## Instrumento 2: PRO-CTCAE Adaptado para Cancer de Bexiga

### Descricao

O PRO-CTCAE (Patient-Reported Outcomes version of the Common Terminology Criteria for Adverse Events) e um sistema desenvolvido pelo National Cancer Institute (NCI) que permite ao paciente relatar a gravidade de eventos adversos associados ao tratamento oncologico. Esta versao foi adaptada para incluir sintomas especificos do cancer de bexiga e seus tratamentos (cirurgia, quimioterapia, imunoterapia intravesical).

A classificacao segue os graus do CTCAE v5.0 (Common Terminology Criteria for Adverse Events, versao 5.0).

**Referencia:** National Cancer Institute. Common Terminology Criteria for Adverse Events (CTCAE) v5.0. U.S. Department of Health and Human Services, 2017.

### Forma de Aplicacao

- **Via WhatsApp:** O agente conversacional do OncoNav apresenta cada sintoma e solicita ao paciente que selecione o grau correspondente (0 a 4), com descricoes simplificadas para cada nivel.
- **Presencial:** Aplicacao pelo enfermeiro navegador durante consulta ambulatorial.

### Periodicidade

- Aplicacao **a cada ciclo de tratamento** (quimioterapia, imunoterapia ou radioterapia).
- Em periodos sem tratamento ativo: aplicacao **mensal**.
- Aplicacoes adicionais sob demanda clinica.

### Criterios de Alerta

- **Alerta:** qualquer sintoma com grau maior ou igual a 3 (grave ou com risco a vida).
- Os alertas sao gerados automaticamente pela plataforma OncoNav.

### Itens e Escala de Resposta

Instrucao ao paciente: "Para cada sintoma abaixo, indique o grau que melhor descreve sua experiencia nos ultimos 7 dias."

#### Sintomas Urologicos Especificos

**1. Hematuria (sangue na urina)**

| Grau | Descricao |
|---|---|
| 0 | Nenhum sangue na urina |
| 1 | Urina levemente rosada ou com tracos de sangue, apenas perceptivel ao olhar |
| 2 | Sangue visivel na urina, sem necessidade de intervencao medica |
| 3 | Sangue abundante na urina, necessitando de intervencao medica (irrigacao vesical, medicacao) |
| 4 | Sangramento grave, necessitando de transfusao ou procedimento de urgencia |

**2. Disuria (dor ou ardencia ao urinar)**

| Grau | Descricao |
|---|---|
| 0 | Nenhuma dor ou ardencia ao urinar |
| 1 | Leve desconforto ao urinar, nao necessitando de medicacao |
| 2 | Dor moderada ao urinar, aliviada com medicacao simples |
| 3 | Dor intensa ao urinar, limitando atividades diarias, necessitando de medicacao forte |
| 4 | Dor incapacitante, necessitando de intervencao de urgencia |

**3. Frequencia urinaria (aumento da frequencia)**

| Grau | Descricao |
|---|---|
| 0 | Frequencia urinaria normal |
| 1 | Aumento leve da frequencia (1-2 vezes a mais do habitual por dia) |
| 2 | Aumento moderado (3-5 vezes a mais), causando algum incomodo |
| 3 | Aumento acentuado, interferindo no sono e atividades diarias |
| 4 | Necessidade de cateterizacao ou intervencao medica |

**4. Urgencia urinaria (vontade subita e intensa de urinar)**

| Grau | Descricao |
|---|---|
| 0 | Sem urgencia urinaria |
| 1 | Urgencia ocasional, sem perda de urina |
| 2 | Urgencia frequente, com dificuldade para segurar, sem perda significativa |
| 3 | Urgencia intensa com episodios de perda de urina, interferindo nas atividades |
| 4 | Urgencia incapacitante, necessitando de intervencao medica |

**5. Incontinencia urinaria (perda involuntaria de urina)**

| Grau | Descricao |
|---|---|
| 0 | Sem perda de urina |
| 1 | Perda ocasional de pequenas quantidades (gotas) com esforco (tosse, espirro) |
| 2 | Perda moderada, necessitando de protetor (fralda/absorvente), sem interferir muito nas atividades |
| 3 | Perda frequente e significativa, interferindo nas atividades diarias, necessitando de troca frequente de protetores |
| 4 | Incontinencia total, necessitando de intervencao cirurgica ou cateterizacao |

#### Sintomas Sistemicos do Tratamento Oncologico

**6. Fadiga (cansaco)**

| Grau | Descricao |
|---|---|
| 0 | Sem cansaco |
| 1 | Cansaco leve, sem interferir nas atividades habituais |
| 2 | Cansaco moderado, dificultando algumas atividades, mas consegue realizar a maioria |
| 3 | Cansaco intenso, limitando significativamente as atividades do dia a dia e o autocuidado |
| 4 | Cansaco incapacitante, necessitando de repouso absoluto |

**7. Nausea**

| Grau | Descricao |
|---|---|
| 0 | Sem nausea |
| 1 | Nausea leve, sem perda de apetite |
| 2 | Nausea moderada, com diminuicao da ingestao alimentar, mas consegue comer |
| 3 | Nausea intensa, com ingestao oral muito reduzida, necessitando de medicacao intravenosa |
| 4 | Nausea incapacitante, necessitando de internacao |

**8. Dor**

| Grau | Descricao |
|---|---|
| 0 | Sem dor |
| 1 | Dor leve, sem necessidade de medicacao ou aliviada com analgesico simples |
| 2 | Dor moderada, necessitando de medicacao regular, com alguma interferencia nas atividades |
| 3 | Dor intensa, limitando atividades diarias e autocuidado, necessitando de medicacao forte (opioide) |
| 4 | Dor incapacitante, necessitando de intervencao urgente |

**9. Mucosite (feridas na boca)**

| Grau | Descricao |
|---|---|
| 0 | Sem alteracoes na boca |
| 1 | Vermelhidao leve ou pequenas feridas, sem dor significativa |
| 2 | Feridas moderadas, com dor, mas conseguindo comer alimentos macios |
| 3 | Feridas extensas e dolorosas, dificultando muito a alimentacao, necessitando de alimentacao liquida ou pastosa |
| 4 | Feridas graves, impossibilitando a alimentacao oral, necessitando de suporte nutricional alternativo |

**10. Neuropatia periferica (dormencia, formigamento ou dor nas maos e pes)**

| Grau | Descricao |
|---|---|
| 0 | Sem dormencia ou formigamento |
| 1 | Dormencia ou formigamento leve, sem interferir nas atividades |
| 2 | Dormencia ou formigamento moderado, com alguma dificuldade em atividades finas (abotoar, escrever) |
| 3 | Dormencia intensa ou dor, limitando significativamente atividades diarias e autocuidado |
| 4 | Perda funcional grave, necessitando de assistencia para atividades basicas |

---

## Instrumento 3: SUS (System Usability Scale)

### Descricao

O SUS (System Usability Scale) e um questionario padronizado de 10 itens para avaliacao de usabilidade de sistemas interativos, desenvolvido por Brooke (1996). E amplamente utilizado na avaliacao de sistemas de saude digital e permite obter uma pontuacao global de usabilidade em escala de 0 a 100.

**Referencia:** Brooke J. SUS: A "Quick and Dirty" Usability Scale. In: Jordan PW, Thomas B, Weerdmeester BA, McClelland IL, editors. Usability Evaluation in Industry. London: Taylor & Francis; 1996. p. 189-194.

### Forma de Aplicacao

- **Online:** Formulario digital (Google Forms ou formulario integrado a plataforma OncoNav) enviado aos profissionais de saude apos o periodo de validacao tecnica.
- **Presencial:** Versao impressa pode ser disponibilizada, se necessario.

### Periodicidade

- Aplicacao **unica**, ao final da Fase 1 (validacao tecnica), apos os profissionais de saude terem utilizado a plataforma por pelo menos 2 semanas.

### Calculo da Pontuacao

1. Para itens impares (1, 3, 5, 7, 9): subtrair 1 da resposta do usuario.
2. Para itens pares (2, 4, 6, 8, 10): subtrair a resposta do usuario de 5.
3. Somar todas as pontuacoes ajustadas e multiplicar por 2,5.
4. O resultado final varia de 0 a 100.

**Classificacao:**
- Pontuacao maior ou igual a 68: usabilidade **aceitavel**
- Pontuacao entre 50 e 67: usabilidade **marginal**
- Pontuacao menor que 50: usabilidade **inaceitavel**

### Itens e Escala de Resposta

Instrucao ao profissional: "Com base na sua experiencia ao utilizar a plataforma OncoNav, indique o seu grau de concordancia com cada afirmacao abaixo."

Escala Likert: 1 = Discordo totalmente | 2 = Discordo | 3 = Neutro | 4 = Concordo | 5 = Concordo totalmente

| N. | Afirmacao | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | Eu gostaria de utilizar a plataforma OncoNav com frequencia. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 2 | Eu achei a plataforma desnecessariamente complexa. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 3 | Eu achei a plataforma facil de usar. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 4 | Eu acho que precisaria do apoio de uma pessoa tecnica para conseguir usar a plataforma. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 5 | Eu achei que as diversas funcoes da plataforma estavam bem integradas. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 6 | Eu achei que havia muita inconsistencia na plataforma. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 7 | Eu imagino que a maioria das pessoas aprenderia a usar a plataforma rapidamente. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 8 | Eu achei a plataforma muito complicada de usar. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 9 | Eu me senti muito confiante ao usar a plataforma. | ( ) | ( ) | ( ) | ( ) | ( ) |
| 10 | Eu precisei aprender muitas coisas antes de conseguir utilizar a plataforma. | ( ) | ( ) | ( ) | ( ) | ( ) |

---

## Instrumento 4: Questionario de Satisfacao do Profissional de Saude

### Descricao

Questionario desenvolvido especificamente para este estudo, com o objetivo de avaliar a percepcao dos profissionais de saude (medicos oncologistas, enfermeiros navegadores, coordenadores) sobre a utilidade, qualidade e integracao da plataforma OncoNav no fluxo de trabalho clinico.

### Forma de Aplicacao

- **Online:** Formulario digital (Google Forms ou formulario integrado a plataforma OncoNav).
- **Presencial:** Versao impressa disponivel, se necessario.

### Periodicidade

- Aplicacao **unica**, ao final do periodo de uso da plataforma (apos a Fase 2 ou ao final da Fase 1 para profissionais envolvidos apenas na validacao tecnica).

### Itens e Escala de Resposta

#### Secao A — Utilidade dos Alertas Clinicos

Escala Likert: 1 = Discordo totalmente | 2 = Discordo | 3 = Neutro | 4 = Concordo | 5 = Concordo totalmente

| N. | Afirmacao | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| A1 | Os alertas gerados pela plataforma OncoNav sao clinicamente relevantes. | ( ) | ( ) | ( ) | ( ) | ( ) |
| A2 | Os alertas me ajudaram a identificar pacientes que necessitavam de atencao imediata. | ( ) | ( ) | ( ) | ( ) | ( ) |
| A3 | A quantidade de alertas recebidos foi adequada (nem excessiva, nem insuficiente). | ( ) | ( ) | ( ) | ( ) | ( ) |
| A4 | Os alertas foram entregues em tempo habil para a tomada de decisao. | ( ) | ( ) | ( ) | ( ) | ( ) |
| A5 | Eu confiaria nos alertas da plataforma para orientar condutas clinicas. | ( ) | ( ) | ( ) | ( ) | ( ) |

#### Secao B — Qualidade da Priorizacao de Casos

| N. | Afirmacao | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| B1 | A priorizacao de pacientes realizada pela plataforma e coerente com meu julgamento clinico. | ( ) | ( ) | ( ) | ( ) | ( ) |
| B2 | A classificacao de risco (disposicao clinica) gerada pela IA e util para o planejamento assistencial. | ( ) | ( ) | ( ) | ( ) | ( ) |
| B3 | A plataforma me ajudou a organizar melhor minha lista de pacientes por prioridade. | ( ) | ( ) | ( ) | ( ) | ( ) |
| B4 | Houve situacoes em que a priorizacao da plataforma discordou do meu julgamento clinico. | ( ) | ( ) | ( ) | ( ) | ( ) |

#### Secao C — Integracao no Fluxo de Trabalho

| N. | Afirmacao | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| C1 | A plataforma OncoNav integrou-se bem ao meu fluxo de trabalho diario. | ( ) | ( ) | ( ) | ( ) | ( ) |
| C2 | O tempo necessario para utilizar a plataforma e aceitavel. | ( ) | ( ) | ( ) | ( ) | ( ) |
| C3 | A plataforma reduziu o tempo que eu gastava para acompanhar pacientes em navegacao oncologica. | ( ) | ( ) | ( ) | ( ) | ( ) |
| C4 | A comunicacao com o paciente via WhatsApp (mediada pela plataforma) e efetiva. | ( ) | ( ) | ( ) | ( ) | ( ) |
| C5 | Eu recomendaria a plataforma OncoNav para outros profissionais de saude. | ( ) | ( ) | ( ) | ( ) | ( ) |

#### Secao D — Avaliacao Geral

| N. | Afirmacao | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| D1 | De modo geral, estou satisfeito(a) com a plataforma OncoNav. | ( ) | ( ) | ( ) | ( ) | ( ) |
| D2 | A plataforma contribuiu para a melhoria da qualidade do cuidado ao paciente oncologico. | ( ) | ( ) | ( ) | ( ) | ( ) |
| D3 | A plataforma e segura em relacao a protecao dos dados dos pacientes. | ( ) | ( ) | ( ) | ( ) | ( ) |

#### Secao E — Perguntas Abertas

| N. | Pergunta |
|---|---|
| E1 | Quais funcionalidades da plataforma OncoNav voce considera mais uteis? Justifique. |
| E2 | Quais funcionalidades voce considera menos uteis ou desnecessarias? Justifique. |
| E3 | Houve alguma situacao em que a plataforma gerou um alerta ou priorizacao que voce considerou inadequado? Descreva. |
| E4 | Quais melhorias ou novas funcionalidades voce sugeriria para a plataforma? |
| E5 | Voce tem algum comentario adicional sobre sua experiencia com a plataforma OncoNav? |

---

## Consideracoes sobre a Aplicacao dos Instrumentos

### Via WhatsApp (ESAS e PRO-CTCAE)

- Os instrumentos serao aplicados pelo agente conversacional do OncoNav de forma automatizada.
- O paciente recebera uma mensagem de introducao explicando o objetivo da avaliacao.
- Cada item sera apresentado individualmente, com linguagem acessivel.
- As respostas serao validadas em tempo real (apenas valores dentro da faixa aceita).
- Os dados serao armazenados de forma segura na plataforma, com criptografia em transito e em repouso.
- Em caso de alerta, o profissional de saude sera notificado imediatamente via painel da plataforma e notificacao push.

### Presencial (todos os instrumentos)

- Versoes impressas estarao disponiveis no ambulatorio de oncologia do HUCAM.
- O enfermeiro navegador podera auxiliar o paciente no preenchimento, sem induzir respostas.
- Os dados coletados em papel serao digitados na plataforma no mesmo dia.

### Online (SUS e Questionario de Satisfacao)

- Formularios digitais serao enviados por e-mail ou link direto aos profissionais de saude participantes.
- O preenchimento e anonimo (sem identificacao nominal do profissional).
- Tempo estimado de preenchimento: 10-15 minutos.

---

_Documento elaborado como parte do protocolo de pesquisa para submissao ao Comite de Etica em Pesquisa._
