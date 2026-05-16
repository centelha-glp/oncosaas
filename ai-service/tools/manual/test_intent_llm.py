import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from src.agent.intent_classifier import intent_classifier

"""
Script manual: classificação de intent via LLM (quando há chaves em .env).
Sem chaves, classify_async devolve GENERAL com metadata.source == no_llm.
"""

AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(AI_SERVICE_ROOT / ".env")


def build_agent_config() -> dict:
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not anthropic_key and not openai_key:
        return {}
    return {
        "anthropic_api_key": anthropic_key or None,
        "openai_api_key": openai_key or None,
        "llm_provider": "anthropic" if anthropic_key else "openai",
        "llm_model": "claude-haiku-4-5" if anthropic_key else "gpt-4o-mini",
        "use_llm_intent_classifier": True,
    }


async def test_intent_llm() -> None:
    agent_config = build_agent_config()
    has_keys = bool(agent_config.get("anthropic_api_key") or agent_config.get("openai_api_key"))

    test_messages = [
        "quero saber mais",
        "me explica isso",
        "e aí, como está?",
        "preciso de uma informação",
        "oi",
    ]

    print("=" * 60)
    print("TESTE: Intent Classifier (LLM quando há chaves)")
    print(f"API keys configuradas: {has_keys}")
    print("=" * 60)

    sample_history = [
        {"role": "assistant", "content": "Quer falar sobre seus sintomas ou sobre agendamento?"},
        {"role": "user", "content": "sobre os sintomas"},
    ]

    for msg in test_messages:
        print(f"\nMensagem: '{msg}'")
        result = await intent_classifier.classify_async(
            msg,
            {},
            agent_config,
            conversation_history=sample_history,
        )
        src = result.get("metadata", {}).get("source")
        print(
            f"  classify_async: intent={result['intent']}, "
            f"confidence={result['confidence']:.2f}, source={src}"
        )
        if has_keys and src == "llm":
            print("  [OK] Classificação via LLM")
        elif not has_keys and src == "no_llm":
            print("  [SKIP] Sem API keys — retorno seguro GENERAL (no_llm)")
        elif src == "llm_error":
            print("  [AVISO] Falha de parse ou exceção na chamada ao modelo")

    print("\n" + "=" * 60)
    print("Fim do teste.")


if __name__ == "__main__":
    asyncio.run(test_intent_llm())
