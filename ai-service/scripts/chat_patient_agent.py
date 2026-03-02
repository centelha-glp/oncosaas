"""CLI interativa para conversar com o agente como se fosse um paciente."""

import asyncio
import json
import os
import sys
import types
from pathlib import Path

from dotenv import load_dotenv

# Permite executar via `python ai-service/scripts/chat_patient_agent.py`
AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_SERVICE_ROOT.parent
sys.path.insert(0, str(AI_SERVICE_ROOT))

# Carrega variáveis do .env da raiz do repositório
load_dotenv(REPO_ROOT / ".env")

# Fallback opcional para ambientes sem SDKs externos
if "openai" not in sys.modules:
    openai_stub = types.ModuleType("openai")
    openai_stub.AsyncOpenAI = object
    sys.modules["openai"] = openai_stub

if "anthropic" not in sys.modules:
    anthropic_stub = types.ModuleType("anthropic")
    anthropic_stub.AsyncAnthropic = object
    sys.modules["anthropic"] = anthropic_stub

from src.agent.orchestrator import orchestrator


def build_initial_session() -> dict:
    """Cria um contexto mínimo para iniciar a conversa."""
    return {
        "patient_id": "patient-demo-001",
        "tenant_id": "tenant-demo-001",
        "clinical_context": {
            "patient": {
                "name": "Paciente Teste",
                "cancerType": "BREAST",
                "stage": "II",
                "currentStage": "treatment",
                "priorityCategory": "medio",
            },
            "recentObservations": [],
            "activeTreatments": [],
            "lastAlerts": [],
        },
        "protocol": {
            "name": "Breast protocol demo",
            "check_ins": {"frequency": "weekly"},
        },
        "conversation_history": [],
        "agent_state": {},
        "agent_config": {
            "agent_language": "pt-BR",
            "llm_provider": "anthropic",
            "llm_model": "claude-sonnet-4-6",
            "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY", ""),
            "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
        },
    }


async def run_chat() -> None:
    session = build_initial_session()

    print("=" * 72)
    print("ONCONAV · Chat Paciente x Agente (interativo)")
    print("Digite sua mensagem como paciente.")
    print("Comandos: /state, /history, /reset, /exit")
    print("=" * 72)

    while True:
        user_input = input("\nVocê (paciente): ").strip()

        if not user_input:
            continue
        if user_input == "/exit":
            print("Encerrando chat.")
            break
        if user_input == "/reset":
            session = build_initial_session()
            print("Sessão reiniciada.")
            continue
        if user_input == "/state":
            print(json.dumps(session["agent_state"], indent=2, ensure_ascii=False))
            continue
        if user_input == "/history":
            print(json.dumps(session["conversation_history"], indent=2, ensure_ascii=False))
            continue

        request = {
            "message": user_input,
            "patient_id": session["patient_id"],
            "tenant_id": session["tenant_id"],
            "clinical_context": session["clinical_context"],
            "protocol": session["protocol"],
            "conversation_history": session["conversation_history"],
            "agent_state": session["agent_state"],
            "agent_config": session["agent_config"],
        }

        result = await orchestrator.process(request)

        response = result.get("response", "")
        actions = result.get("actions", [])
        decisions = result.get("decisions", [])

        print(f"\nAgente: {response}")

        if actions:
            print("\n[Ações sugeridas]")
            for action in actions:
                print(f"- {action.get('type')}: {json.dumps(action.get('payload', {}), ensure_ascii=False)}")

        if decisions:
            print("\n[Decisões]")
            for decision in decisions:
                print(f"- {decision.get('decisionType')}: {decision.get('reasoning')}")

        session["conversation_history"].append({"role": "user", "content": user_input})
        session["conversation_history"].append({"role": "assistant", "content": response})
        session["agent_state"] = result.get("new_state", session["agent_state"])


if __name__ == "__main__":
    asyncio.run(run_chat())
