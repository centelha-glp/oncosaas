---
name: whatsapp
description: Aciona o agente whatsapp-integration para configurar webhook, templates, OAuth e canais de comunicação WhatsApp Business API
---

# Skill: /whatsapp

## Descrição

Aciona o agente `whatsapp-integration` para tarefas relacionadas ao canal WhatsApp Business API, webhook, mensagens e conexões por tenant.

## Uso

```
/whatsapp [contexto ou tarefa]
```

### Exemplos

- `/whatsapp configurar webhook para novo tenant` — configura endpoint e validação de assinatura
- `/whatsapp debug mensagem não chegando` — diagnóstico do pipeline inbound
- `/whatsapp adicionar template de lembrete de consulta` — cria template Meta
- `/whatsapp oauth flow para tenant HUCAM` — implementa fluxo de autenticação OAuth
- `/whatsapp verificar assinatura HMAC` — valida implementação de segurança do webhook

## O que faz

1. Lê configuração dos módulos `whatsapp-connections/` e `channel-gateway/`
2. Implementa ou corrige o pipeline de mensagem (inbound/outbound)
3. Configura autenticação OAuth, Manual ou API Key por tenant
4. Garante `200 OK` imediato no webhook + `setImmediate()` para processamento
5. Valida assinatura HMAC-SHA256 com `timingSafeEqual`
6. Assegura deduplicação por `whatsappMessageId` e isolamento de tenant

## Pipeline de mensagem inbound

```
Meta → POST /webhook → 200 OK imediato
    → setImmediate()
    → validateWebhookSignature (HMAC)
    → parsePayload
    → lookup por phoneHash → Patient
    → deduplicação por whatsappMessageId
    → persistir Message
    → WebSocket emit (após persistência)
    → trigger agente IA (somente TEXT)
```

## Referências

- Rules: `.cursor/rules/whatsapp-integration.mdc`
- Módulos: `backend/src/whatsapp-connections/`, `backend/src/channel-gateway/`, `backend/src/messages/`
- Encryption: `backend/src/whatsapp-connections/utils/encryption.util.ts`
