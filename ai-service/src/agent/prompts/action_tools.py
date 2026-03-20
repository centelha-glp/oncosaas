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
]
