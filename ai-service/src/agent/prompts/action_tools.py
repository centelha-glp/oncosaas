"""
Tool definitions for LLM-based action decisions.
The LLM uses these tools to decide what actions to take based on the patient's message,
replacing hard-coded keyword rules with contextual understanding.
"""

AGENT_ACTION_TOOLS = [
    {
        "name": "registrar_sintoma",
        "description": (
            "Registra um sintoma reportado pelo paciente. Use sempre que o paciente "
            "mencionar qualquer desconforto, dor, efeito colateral ou mudança no estado de saúde."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "nome": {
                    "type": "string",
                    "description": "Nome do sintoma em português (ex: dor, nausea, febre, fadiga, diarreia, mucosite, insonia, vomito)",
                },
                "severidade": {
                    "type": "string",
                    "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                    "description": "Severidade baseada na intensidade, duração e impacto funcional",
                },
                "descricao": {
                    "type": "string",
                    "description": "Descrição incluindo intensidade (0-10), duração, localização e fatores relevantes",
                },
            },
            "required": ["nome", "severidade"],
        },
    },
    {
        "name": "criar_alerta",
        "description": (
            "Cria um alerta para a equipe de enfermagem. Use quando sintomas requerem "
            "atenção profissional: febre em quimioterapia, dor não controlada, sangramento, "
            "sinais de infecção, ou qualquer sintoma CRITICAL/HIGH."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "severidade": {
                    "type": "string",
                    "enum": ["MEDIUM", "HIGH", "CRITICAL"],
                    "description": "CRITICAL: risco de vida imediato; HIGH: precisa avaliação em horas; MEDIUM: avaliar no próximo dia útil",
                },
                "motivo": {
                    "type": "string",
                    "description": "Motivo clínico do alerta com detalhes relevantes",
                },
            },
            "required": ["severidade", "motivo"],
        },
    },
    {
        "name": "iniciar_questionario",
        "description": (
            "Inicia um questionário clínico padronizado. ESAS para avaliação geral de sintomas, "
            "PRO_CTCAE para efeitos colaterais de tratamento. Use quando o paciente relata "
            "múltiplos sintomas vagos ou quando é hora de uma avaliação periódica."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tipo": {
                    "type": "string",
                    "enum": ["ESAS", "PRO_CTCAE"],
                    "description": "ESAS: avaliação geral; PRO_CTCAE: toxicidade de tratamento",
                },
                "motivo": {
                    "type": "string",
                    "description": "Razão clínica para iniciar o questionário",
                },
            },
            "required": ["tipo"],
        },
    },
    {
        "name": "agendar_checkin",
        "description": (
            "Agenda um check-in de acompanhamento. Use após estabilização de sintoma, "
            "mudança de medicação, ou quando o paciente precisa de monitoramento próximo."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dias": {
                    "type": "integer",
                    "description": "Dias até o próximo check-in (1-30). 1-2 para sintomas ativos, 7 para acompanhamento, 14-30 para rotina.",
                },
                "motivo": {
                    "type": "string",
                    "description": "Razão para o acompanhamento",
                },
            },
            "required": ["dias"],
        },
    },
    {
        "name": "escalar_para_enfermagem",
        "description": (
            "Escala o caso para atendimento imediato da equipe de enfermagem. "
            "Use em situações que requerem avaliação profissional urgente: "
            "febre neutropênica, dor incontrolável, sangramento, dispneia aguda, "
            "confusão mental, sinais de trombose."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "motivo": {
                    "type": "string",
                    "description": "Descrição clínica da situação que requer escalação",
                },
                "urgencia": {
                    "type": "string",
                    "enum": ["MEDIUM", "HIGH", "CRITICAL"],
                    "description": "CRITICAL: risco de vida; HIGH: urgente em horas; MEDIUM: próximo turno",
                },
            },
            "required": ["motivo", "urgencia"],
        },
    },
    {
        "name": "recomendar_consulta",
        "description": (
            "Recomenda agendamento de consulta com especialista. "
            "Use quando o paciente precisa de avaliação especializada que o agente não pode resolver: "
            "ajuste de medicação, avaliação nutricional, suporte psicológico, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "especialidade": {
                    "type": "string",
                    "description": "Especialidade (oncologia, enfermagem, nutrição, psicologia, fisioterapia, dor, paliativo)",
                },
                "motivo": {
                    "type": "string",
                    "description": "Motivo clínico da recomendação",
                },
            },
            "required": ["especialidade", "motivo"],
        },
    },
    {
        "name": "enviar_lembrete",
        "description": (
            "Agenda um lembrete para enviar mensagem ao paciente em data futura. "
            "Use quando o paciente pedir para lembrá-lo de algo, ou quando for útil "
            "retomar contato (ex: lembrar de agendar exame, tomar medicação, retornar contato)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "mensagem": {
                    "type": "string",
                    "description": "Texto do lembrete a ser enviado ao paciente",
                },
                "dias": {
                    "type": "integer",
                    "description": "Dias a partir de hoje para enviar o lembrete (1-30). Padrão 1.",
                },
                "tipo": {
                    "type": "string",
                    "enum": ["FOLLOW_UP", "APPOINTMENT_REMINDER", "MEDICATION_REMINDER"],
                    "description": "FOLLOW_UP: acompanhamento geral; APPOINTMENT_REMINDER: lembrete de consulta/exame; MEDICATION_REMINDER: lembrete de medicação",
                },
            },
            "required": ["mensagem"],
        },
    },
    {
        "name": "recalcular_prioridade",
        "description": (
            "Recalcula o score de prioridade do paciente usando o algoritmo de ML. "
            "Use SEMPRE que algum dado clínico for coletado: sintoma registrado, "
            "resposta a questionário (ESAS, PRO-CTCAE), resultado de exame complementar, "
            "ou atualização de dado clínico (diagnóstico, estágio, performance status)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "motivo": {
                    "type": "string",
                    "description": "Breve indicação do que disparou o recálculo (ex: questionário ESAS concluído, sintoma dor registrado)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "atualizar_etapa_navegacao",
        "description": (
            "Marca uma etapa de navegação como concluída ou em andamento. "
            "Use quando o paciente confirmar que realizou uma etapa (ex: fez a colonoscopia, "
            "realizou a biópsia, concluiu a cirurgia). Use a chave exata da etapa do contexto."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "step_key": {
                    "type": "string",
                    "description": "Chave da etapa (ex: colonoscopy, biopsy, surgery). Use o valor entre [chave: X] do contexto.",
                },
                "concluida": {
                    "type": "boolean",
                    "description": "True se a etapa foi concluída, False para marcar em andamento",
                },
            },
            "required": ["step_key", "concluida"],
        },
    },
    {
        "name": "informar_agenda_navegacao",
        "description": (
            "Registra na auditoria que você respondeu ao paciente sobre datas/horários de consultas, "
            "exames, retornos ou próximas etapas do plano (incluindo prazos meta vs agendamento confirmado). "
            "Chame ao finalizar a orientação de agenda após usar o contexto de navegação."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "notas": {
                    "type": "string",
                    "description": "Resumo curto do que foi explicado (opcional, para auditoria).",
                },
                "motivo": {
                    "type": "string",
                    "description": "Motivo ou foco da resposta (opcional, ex.: consulta de prazo de etapa).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "criar_consulta",
        "description": (
            "Cria UMA consulta na agenda. USE SOMENTE quando médico/profissional, data/hora e "
            "identificação do paciente estiverem completos E o paciente tiver confirmado "
            "EXPLICITAMENTE o resumo no chat. Se o paciente não existir no sistema, "
            "preencha `patientIntake` com os dados mínimos do cadastro rápido."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "scheduledProfessionalId": {
                    "type": "string",
                    "description": "ID do profissional/médico que realizará a consulta.",
                },
                "expectedDate": {
                    "type": "string",
                    "description": "Data e hora desejadas em ISO 8601 (ex: 2026-06-15T10:00:00-03:00).",
                },
                "patientId": {
                    "type": "string",
                    "description": "ID do paciente existente no tenant. Omita se for criar paciente novo via patientIntake.",
                },
                "patientIntake": {
                    "type": "object",
                    "description": (
                        "Dados básicos para criar paciente novo (somente se patientId não existir). "
                        "Todos os campos do formulário de cadastro rápido."
                    ),
                    "properties": {
                        "name": {"type": "string", "description": "Nome completo."},
                        "cpf": {"type": "string", "description": "CPF (somente dígitos ou formatado)."},
                        "birthDate": {"type": "string", "description": "Data de nascimento ISO (YYYY-MM-DD)."},
                        "gender": {
                            "type": "string",
                            "description": "Sexo (ex: MALE, FEMALE, OTHER).",
                        },
                        "phone": {"type": "string", "description": "Telefone com DDI/DDD para WhatsApp."},
                        "email": {"type": "string", "description": "E-mail de contato (opcional)."},
                        "healthCoverageType": {
                            "type": "string",
                            "description": "Cobertura de saúde (ex: SUS, PRIVATE, INSURANCE).",
                        },
                    },
                },
                "stepKey": {
                    "type": "string",
                    "description": "Chave da etapa de navegação associada (opcional).",
                },
                "stepName": {
                    "type": "string",
                    "description": "Nome humano da etapa/consulta (opcional, ex.: 'Consulta oncológica de retorno').",
                },
                "notes": {
                    "type": "string",
                    "description": "Observações curtas para a equipe (opcional).",
                },
                "confirmacao_paciente": {
                    "type": "boolean",
                    "description": (
                        "OBRIGATÓRIO ser true. Marque true APENAS quando o paciente confirmou "
                        "explicitamente no chat (ex.: 'sim, pode marcar', 'confirmo') depois de "
                        "você mostrar o resumo. Nunca presuma confirmação."
                    ),
                },
            },
            "required": ["scheduledProfessionalId", "expectedDate", "confirmacao_paciente"],
        },
    },
    {
        "name": "reagendar_consulta",
        "description": (
            "Reagenda uma consulta existente do paciente (nova data/hora e, se preciso, novo profissional). "
            "USE SOMENTE com identificação inequívoca da consulta (navigationStepId) E confirmação "
            "explícita do paciente sobre a nova data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "navigationStepId": {
                    "type": "string",
                    "description": "ID da etapa de navegação / consulta existente.",
                },
                "newExpectedDate": {
                    "type": "string",
                    "description": "Nova data/hora ISO 8601.",
                },
                "newScheduledProfessionalId": {
                    "type": "string",
                    "description": "ID do novo profissional (opcional, só se houver troca).",
                },
                "motivo": {
                    "type": "string",
                    "description": "Motivo curto do reagendamento (opcional).",
                },
                "confirmacao_paciente": {
                    "type": "boolean",
                    "description": (
                        "OBRIGATÓRIO ser true. Marque true APENAS após o paciente confirmar "
                        "explicitamente a nova data no chat."
                    ),
                },
            },
            "required": ["navigationStepId", "newExpectedDate", "confirmacao_paciente"],
        },
    },
    {
        "name": "cancelar_consulta",
        "description": (
            "Cancela uma consulta existente do paciente. USE SOMENTE com identificação inequívoca "
            "da consulta (navigationStepId), motivo resumido e confirmação explícita do paciente."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "navigationStepId": {
                    "type": "string",
                    "description": "ID da etapa de navegação / consulta existente.",
                },
                "motivo": {
                    "type": "string",
                    "description": "Motivo curto do cancelamento.",
                },
                "confirmacao_paciente": {
                    "type": "boolean",
                    "description": (
                        "OBRIGATÓRIO ser true. Marque true APENAS após o paciente confirmar "
                        "explicitamente o cancelamento."
                    ),
                },
            },
            "required": ["navigationStepId", "confirmacao_paciente"],
        },
    },
    {
        "name": "confirmar_consulta",
        "description": (
            "Registra confirmação de comparecimento/ciência do paciente sobre uma consulta existente. "
            "USE SOMENTE com identificação inequívoca da consulta (navigationStepId) e quando o "
            "paciente disser explicitamente que comparecerá."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "navigationStepId": {
                    "type": "string",
                    "description": "ID da etapa de navegação / consulta existente.",
                },
                "notas": {
                    "type": "string",
                    "description": "Observações curtas (opcional).",
                },
                "confirmacao_paciente": {
                    "type": "boolean",
                    "description": (
                        "OBRIGATÓRIO ser true. Marque true APENAS após confirmação explícita "
                        "do paciente sobre comparecimento."
                    ),
                },
            },
            "required": ["navigationStepId", "confirmacao_paciente"],
        },
    },
]
