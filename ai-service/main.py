import json
import logging
from pathlib import Path
from fastapi import FastAPI
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from src.routes import router

"""
AI Service - Plataforma Oncológica
Serviço de IA para priorização de casos e agente conversacional
"""

# Load environment variables early, before importing modules that may read os.getenv.
# Source of truth: ai-service/.env only.
BASE_DIR = Path(__file__).resolve().parent
LOCAL_ENV_PATH = BASE_DIR / ".env"

_env_loaded = []
if LOCAL_ENV_PATH.exists():
    load_dotenv(LOCAL_ENV_PATH, override=True)
    _env_loaded.append(str(LOCAL_ENV_PATH))
else:
    _env_loaded.append(f"(not found: {LOCAL_ENV_PATH})")


class _JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON for structured log ingestion."""
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
        })

_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(__name__)

# Load priority model BEFORE routes (ensures routes.py gets trained instance)
try:
    from src.models.train_priority import load_or_train
    load_or_train()
    from src.models.priority_model import priority_model
    logger.info("Priority model loaded at startup: is_trained=%s", priority_model.is_trained)
except Exception as e:
    logger.warning("Priority model initialization deferred: %s", e, exc_info=True)


class Settings(BaseSettings):
    """Carrega `.env` local; campos espelham `ai-service/.env.example`."""

    model_config = SettingsConfigDict(env_file=str(LOCAL_ENV_PATH), env_file_encoding="utf-8")

    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_cloud_project_id: str = ""
    backend_url: str = "http://localhost:3002"
    backend_service_token: str = ""
    cors_origins: str = "http://localhost:3000,http://localhost:3002"
    rag_embedding_model: str = (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    rag_top_k: int = 4
    rag_score_threshold: float = 0.30


settings = Settings()

if not settings.openai_api_key and not settings.anthropic_api_key:
    logger.warning(
        "No LLM API key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY). "
        "Agent will use fallback mock responses. Set at least one key for production."
    )


def _mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return "(empty or too short)"
    return key[:4] + "..." + key[-4:]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("[AI Service] Starting... (env loaded from: %s)", _env_loaded)
    import os
    has_openai = bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY", "").strip() not in ("", "your-openai-api-key", "none", "null"))
    has_anthropic = bool(os.getenv("ANTHROPIC_API_KEY") and os.getenv("ANTHROPIC_API_KEY", "").strip().lower() not in ("", "your-anthropic-api-key", "none", "null"))
    logger.info("[AI Service] LLM keys in env: OPENAI=%s ANTHROPIC=%s", has_openai, has_anthropic)
    if has_openai:
        logger.info("[AI Service] OPENAI_API_KEY present: %s", _mask_key(os.getenv("OPENAI_API_KEY", "")))
    if has_anthropic:
        logger.info("[AI Service] ANTHROPIC_API_KEY present: %s", _mask_key(os.getenv("ANTHROPIC_API_KEY", "")))
    try:
        from src.agent.rag import knowledge_rag
        knowledge_rag.initialize()
    except Exception as e:
        logger.warning(f"RAG initialization deferred: {e}")
    # Priority model loaded at import time (see top of main.py)
    yield
    # Shutdown
    logger.info("[AI Service] Shutting down...")

app = FastAPI(
    title="ONCONAV AI Service",
    description="Serviço de IA para priorização e agente conversacional",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — configure CORS_ORIGINS env var for production (comma-separated list)
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(router, prefix="/api/v1", tags=["ai"])

@app.get("/")
async def root():
    return {"message": "ONCONAV AI Service"}

@app.get("/health")
async def health():
    from src.models.priority_model import priority_model
    return {
        "status": "ok",
        "service": "onconav-ai-service",
        "model_trained": priority_model.is_trained,
        "llm_configured": bool(settings.openai_api_key or settings.anthropic_api_key),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
