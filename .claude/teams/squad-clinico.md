---
name: squad-clinico
description: Squad Clínico — domínio oncológico, FHIR e WhatsApp do ONCONAV
---

# Squad Clínico

Equipe responsável pela lógica clínica oncológica e integrações de saúde do ONCONAV.

## Teammates

### clinical-domain
Papel: validação de protocolos e regras clínicas oncológicas.
Responsabilidades:
- Validar as 23 regras clínicas determinísticas (11 ER_IMMEDIATE, 6 ER_DAYS, 4 ADVANCE, 2 SCHEDULED)
- Revisar scores MASCC (≤20 = alto risco) e CISNE (≥3 = alto risco)
- Validar ECOG, TNM staging, ESAS/PRO-CTCAE
- Garantir que a lógica clínica seja implementada corretamente nos protocolos

### fhir-integration
Papel: interoperabilidade HL7/FHIR R4 com sistemas hospitalares.
Responsabilidades:
- Implementar mapeamentos FHIR R4 (Patient, Condition, Observation, MedicationRequest, CarePlan)
- Integrar com RNDS (namespace CPF: `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf`)
- Garantir conformidade LGPD no tráfego de PHI
- Testar interoperabilidade com HIS/PEP

### whatsapp-integration
Papel: WhatsApp Business API, webhook e comunicação com pacientes.
Responsabilidades:
- Implementar fluxo webhook → channel-gateway → agent.service
- Validar HMAC-SHA256 nas requisições Meta
- Garantir opt-in/opt-out e conformidade com política Meta
- Gerenciar janela de 24h e templates de mensagem aprovados

## Coordenação

1. **clinical-domain** valida as regras e protocolos antes de qualquer implementação
2. **fhir-integration** e **whatsapp-integration** implementam em paralelo seus domínios
3. **clinical-domain** faz revisão final da lógica antes do merge

## Quando acionar este squad

- Implementar ou revisar regras clínicas
- Adicionar novo protocolo oncológico
- Integrar com sistema hospitalar (HIS/PEP)
- Configurar ou depurar integração WhatsApp
- Validar scores clínicos (MASCC, CISNE, ECOG)
