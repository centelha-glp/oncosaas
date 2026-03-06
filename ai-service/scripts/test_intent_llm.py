"""
Script para testar se o Intent Classifier chama a LLM no fallback.
Mensagens ambíguas (baixa confiança no regex) devem acionar a LLM.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_SERVICE_ROOT.parent
sys.path.insert(0, str(AI_SERVICE_ROOT))

load_dotenv(REPO_ROOT / ".env")
load_dotenv(AI_SERVICE_ROOT / ".env")

# Logs visíveis para ver "Intent LLM fallback"
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from src.agent.intent_classifier import intent_classifier, CONFIDENCE_THRESHOLD_LLM


def build_agent_config() -> dict:
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not anthropic_key and not openai_key:
        return {}
    return {
        "anthropic_api_key": anthropic_key or None,
        "openai_api_key": openai_key or None,
        "llm_provider": "anthropic" if anthropic_key else "openai",
        "llm_model": "claude-sonnet-4-6" if anthropic_key else "gpt-4o-mini",
        "use_llm_intent_classifier": True,
    }


async def test_intent_llm() -> None:
    agent_config = build_agent_config()
    has_keys = bool(agent_config.get("anthropic_api_key") or agent_config.get("openai_api_key"))

    # Mensagens que tendem a dar confiança baixa no regex (< 0.65)
    test_messages = [
        "quero saber mais",
        "me explica isso",
        "e aí, como está?",
        "preciso de uma informação",
    ]

    print("=" * 60)
    print("TESTE: Intent Classifier + LLM Fallback")
    print(f"API keys configuradas: {has_keys}")
    print(f"Threshold para LLM: {CONFIDENCE_THRESHOLD_LLM}")
    print("=" * 60)

    for msg in test_messages:
        print(f"\nMensagem: '{msg}'")
        regex_only = intent_classifier.classify(msg)
        print(f"  Regex: intent={regex_only['intent']}, confidence={regex_only['confidence']:.2f}")

        result = await intent_classifier.classify_async(msg, {}, agent_config)
        llm_used = result.get("metadata", {}).get("source") == "llm"
        print(f"  classify_async: intent={result['intent']}, confidence={result['confidence']:.2f}")
        print(f"  LLM chamada: {'SIM' if llm_used else 'NÃO'}")
        if llm_used:
            print("  [OK] Fallback LLM foi acionado!")
        elif regex_only["confidence"] >= CONFIDENCE_THRESHOLD_LLM:
            print("  [SKIP] Confiança alta no regex, LLM não necessária")
        elif not has_keys:
            print("  [SKIP] Sem API keys, LLM não disponível")

    print("\n" + "=" * 60)
    print("Fim do teste.")


if __name__ == "__main__":
    asyncio.run(test_intent_llm())
