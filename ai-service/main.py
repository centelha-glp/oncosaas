"""
AI Service - Plataforma Oncológica
Serviço de IA para priorização de casos e agente conversacional
"""

import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables early, before importing modules that may read os.getenv.
# Priority order:
# 1) Project root .env (../.env) for shared local dev config
# 2) ai-service/.env for service-specific overrides
BASE_DIR = Path(__file__).resolve().parent
ROOT_ENV_PATH = BASE_DIR.parent / ".env"
LOCAL_ENV_PATH = BASE_DIR / ".env"

if ROOT_ENV_PATH.exists():
    load_dotenv(ROOT_ENV_PATH, override=True)
if LOCAL_ENV_PATH.exists():
    load_dotenv(LOCAL_ENV_PATH, override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load priority model BEFORE routes (ensures routes.py gets trained instance)
try:
    from src.models.train_priority import load_or_train
    load_or_train()
    from src.models.priority_model import priority_model
    logger.info("Priority model loaded at startup: is_trained=%s", priority_model.is_trained)
except Exception as e:
    logger.warning("Priority model initialization deferred: %s", e, exc_info=True)

from src.api.routes import router


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_cloud_project_id: str = ""
    backend_url: str = "http://localhost:3002"

    class Config:
        env_file = ".env"


settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("[AI Service] Starting...")
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(router, prefix="/api/v1", tags=["ai"])

@app.get("/")
async def root():
    return {"message": "ONCONAV AI Service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

