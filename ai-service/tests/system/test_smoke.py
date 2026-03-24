"""
Import-level smoke tests — verify all major modules and singletons load without error.
"""

class TestModuleImports:

    def test_priority_model_imports(self):
        from src.models.priority_model import OncologyPriorityModel
        assert OncologyPriorityModel is not None

    def test_clinical_rules_imports(self):
        from src.agent.clinical_rules import ClinicalRulesEngine
        assert ClinicalRulesEngine is not None

    def test_llm_provider_imports(self):
        from src.agent.llm_provider import LLMProvider
        assert LLMProvider is not None

    def test_backend_client_imports(self):
        from src.services.backend_client import BackendClient
        assert BackendClient is not None

    def test_tracer_imports(self):
        from src.agent.tracer import AgentTracer, tracer
        assert AgentTracer is not None
        assert tracer is not None

    def test_symptom_analyzer_imports(self):
        from src.agent.symptom_analyzer import SymptomAnalyzer
        assert SymptomAnalyzer is not None

    def test_rag_imports(self):
        from src.agent.rag.knowledge_base import OncologyKnowledgeRAG
        assert OncologyKnowledgeRAG is not None


class TestSingletonAccessibility:

    def test_priority_model_singleton_accessible(self):
        from src.models.priority_model import priority_model
        assert priority_model is not None

    def test_clinical_rules_engine_singleton_accessible(self):
        from src.agent.clinical_rules import clinical_rules_engine
        assert clinical_rules_engine is not None

    def test_llm_provider_singleton_accessible(self):
        from src.agent.llm_provider import llm_provider
        assert llm_provider is not None

    def test_backend_client_singleton_accessible(self):
        from src.services.backend_client import backend_client
        assert backend_client is not None

    def test_knowledge_rag_singleton_accessible(self):
        from src.agent.rag.knowledge_base import knowledge_rag
        assert knowledge_rag is not None


class TestSchemaConstants:

    def test_feature_columns_has_32_entries(self):
        from src.models.priority_model import FEATURE_COLUMNS
        assert len(FEATURE_COLUMNS) == 32, f"Expected 32, got {len(FEATURE_COLUMNS)}"

    def test_disposition_classes_has_5_entries(self):
        from src.models.priority_model import DISPOSITION_CLASSES
        assert len(DISPOSITION_CLASSES) == 5, f"Expected 5, got {len(DISPOSITION_CLASSES)}"

    def test_disposition_classes_values(self):
        from src.models.priority_model import DISPOSITION_CLASSES
        expected = {
            "REMOTE_NURSING",
            "SCHEDULED_CONSULT",
            "ADVANCE_CONSULT",
            "ER_DAYS",
            "ER_IMMEDIATE",
        }
        assert set(DISPOSITION_CLASSES) == expected

    def test_feature_columns_are_unique(self):
        from src.models.priority_model import FEATURE_COLUMNS
        assert len(FEATURE_COLUMNS) == len(set(FEATURE_COLUMNS))
