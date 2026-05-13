"""
Valores padrão do RAG oncológico.
Variáveis de ambiente RAG_* em ai-service/.env substituem estes valores após load_dotenv.
"""

DEFAULT_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_TOP_K = 4
DEFAULT_SCORE_THRESHOLD = 0.30
