"""
AI Service - Plataforma Oncológica
Serviço de IA para priorização de casos e agente conversacional
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from contextlib import asynccontextmanager
from src.api.routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

