"""
RAG (Retrieval-Augmented Generation) module for oncology knowledge.
Uses sentence-transformers for embeddings and FAISS for vector search
to retrieve relevant oncology knowledge before calling the LLM.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_CORPUS_PATH = Path(__file__).parent / "oncology_corpus.json"


def _get_index_dir() -> Path:
    """Retorna diretório para cache FAISS. Em Windows, usa LOCALAPPDATA se o path
    do projeto tiver caracteres não-ASCII (ex: Área de Trabalho), pois FAISS falha com Unicode."""
    default = Path(__file__).parent / ".index_cache"
    if os.name == "nt":  # Windows
        try:
            path_str = str(default.resolve())
            path_str.encode("ascii")  # path é ASCII-only?
        except UnicodeEncodeError:
            base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
            return Path(base) / "OncoNav" / "rag_index_cache"
    return default


_INDEX_DIR = _get_index_dir()

_MODEL_NAME = os.getenv("RAG_EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
_TOP_K = int(os.getenv("RAG_TOP_K", "4"))
_SCORE_THRESHOLD = float(os.getenv("RAG_SCORE_THRESHOLD", "0.30"))


class OncologyKnowledgeRAG:
    """
    Retrieval-Augmented Generation service that:
    1. Loads oncology knowledge documents from a JSON corpus
    2. Creates embeddings using sentence-transformers
    3. Indexes them with FAISS for fast similarity search
    4. Retrieves relevant passages given a patient query + optional cancer type filter
    """

    def __init__(self):
        self._model = None
        self._index = None
        self._documents: List[Dict[str, Any]] = []
        self._ready = False

    @property
    def is_ready(self) -> bool:
        return self._ready

    def initialize(self) -> bool:
        """Load corpus, build embeddings and FAISS index. Safe to call multiple times."""
        if self._ready:
            return True

        try:
            self._documents = self._load_corpus()
            if not self._documents:
                logger.warning("RAG corpus is empty, knowledge retrieval disabled")
                return False

            self._model = self._load_embedding_model()
            if self._model is None:
                return False

            self._index = self._build_or_load_index()
            self._ready = self._index is not None
            if self._ready:
                logger.info(
                    f"RAG initialized: {len(self._documents)} documents, "
                    f"model={_MODEL_NAME}"
                )
            return self._ready

        except Exception as exc:
            logger.error(f"Failed to initialize RAG: {exc}", exc_info=True)
            return False

    def retrieve(
        self,
        query: str,
        cancer_type: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the most relevant knowledge passages for a patient query.

        Returns list of dicts with keys: id, title, content, score, category.
        Results are filtered by score threshold and optionally by cancer type.
        """
        if not self._ready:
            if not self.initialize():
                return []

        k = top_k or _TOP_K

        try:
            query_embedding = self._model.encode([query], normalize_embeddings=True)
            scores, indices = self._index.search(
                np.array(query_embedding, dtype=np.float32), min(k * 3, len(self._documents))
            )

            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0 or idx >= len(self._documents):
                    continue
                doc = self._documents[idx]

                if cancer_type and cancer_type != "ALL":
                    doc_types = doc.get("cancer_types", ["ALL"])
                    if "ALL" not in doc_types and cancer_type not in doc_types:
                        continue

                similarity = float(score)
                if similarity < _SCORE_THRESHOLD:
                    continue

                results.append({
                    "id": doc["id"],
                    "title": doc["title"],
                    "content": doc["content"],
                    "category": doc.get("category", "general"),
                    "score": round(similarity, 4),
                })

                if len(results) >= k:
                    break

            return results

        except Exception as exc:
            logger.error(f"RAG retrieval failed: {exc}", exc_info=True)
            return []

    def format_context(self, passages: List[Dict[str, Any]]) -> str:
        """Format retrieved passages into a string block for injection into the LLM prompt."""
        if not passages:
            return ""

        lines = ["## Base de Conhecimento Relevante\n"]
        for i, p in enumerate(passages, 1):
            lines.append(f"**[{i}] {p['title']}**")
            lines.append(p["content"])
            lines.append("")

        return "\n".join(lines)

    # -- internal helpers --

    def _load_corpus(self) -> List[Dict[str, Any]]:
        if not _CORPUS_PATH.exists():
            logger.warning(f"Corpus file not found: {_CORPUS_PATH}")
            return []

        with open(_CORPUS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        logger.info(f"Loaded {len(data)} documents from corpus")
        return data

    def _load_embedding_model(self):
        try:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer(_MODEL_NAME)
            logger.info(f"Embedding model loaded: {_MODEL_NAME}")
            return model
        except ImportError:
            logger.error(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
            return None
        except Exception as exc:
            logger.error(f"Failed to load embedding model: {exc}", exc_info=True)
            return None

    def _build_or_load_index(self):
        try:
            import faiss
        except ImportError:
            logger.error("faiss-cpu not installed. Install with: pip install faiss-cpu")
            return None

        # Garantir que o diretório existe antes de qualquer operação FAISS
        index_dir = _INDEX_DIR.resolve()
        index_dir.mkdir(parents=True, exist_ok=True)

        cache_file = index_dir / "faiss.index"
        meta_file = index_dir / "meta.json"

        corpus_hash = self._corpus_hash()
        if cache_file.exists() and meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if meta.get("hash") == corpus_hash and meta.get("model") == _MODEL_NAME:
                    index = faiss.read_index(str(cache_file))
                    logger.info("Loaded FAISS index from cache")
                    return index
            except Exception:
                logger.info("Cache invalid, rebuilding index")

        texts = [doc.get("content", "") for doc in self._documents]
        logger.info(f"Encoding {len(texts)} documents...")
        embeddings = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        embeddings = np.array(embeddings, dtype=np.float32)

        dimension = embeddings.shape[1]
        index = faiss.IndexFlatIP(dimension)
        index.add(embeddings)

        faiss.write_index(index, str(cache_file))
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump({"hash": corpus_hash, "model": _MODEL_NAME, "n_docs": len(texts)}, f)
        logger.info(f"Built and cached FAISS index: dim={dimension}, n={len(texts)}")

        return index

    def _corpus_hash(self) -> str:
        import hashlib

        raw = json.dumps([d.get("id", "") + d.get("content", "") for d in self._documents], sort_keys=True)
        return hashlib.md5(raw.encode()).hexdigest()


knowledge_rag = OncologyKnowledgeRAG()
