import pytest
import numpy as np
import pandas as pd

"""
Tests for the OncologyPriorityModel class.
"""

from src.models.priority_model import OncologyPriorityModel, FEATURE_COLUMNS, DISPOSITION_CLASSES


def _make_row(**overrides) -> dict:
    """Build a minimal valid 32-feature row (defaults all zero)."""
    row = {col: 0 for col in FEATURE_COLUMNS}
    row.update(overrides)
    return row


def _make_df(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(rows)[FEATURE_COLUMNS]


def _minimal_train_data() -> tuple[pd.DataFrame, pd.Series]:
    """Generate minimal labelled training data covering all 5 classes."""
    rows = [
        _make_row(age=60, pain_score=0, ecog_score=0),                          # 0 REMOTE_NURSING
        _make_row(age=55, pain_score=3, ecog_score=1, days_since_last_visit=10), # 1 SCHEDULED_CONSULT
        _make_row(age=65, pain_score=5, ecog_score=2, fatigue_score=6),          # 2 ADVANCE_CONSULT
        _make_row(age=70, pain_score=7, ecog_score=2, has_fever=1),              # 3 ER_DAYS
        _make_row(age=72, pain_score=9, ecog_score=3, has_fever=1, in_nadir_window=1),  # 4 ER_IMMEDIATE
        # Duplicate rows so LightGBM has enough samples per class
        _make_row(age=58, pain_score=0, ecog_score=0),
        _make_row(age=52, pain_score=2, ecog_score=1),
        _make_row(age=67, pain_score=6, ecog_score=2),
        _make_row(age=68, pain_score=8, ecog_score=2),
        _make_row(age=75, pain_score=10, ecog_score=4, has_fever=1),
    ]
    X = _make_df(rows)
    y = pd.Series([0, 1, 2, 3, 4, 0, 1, 2, 3, 4])
    return X, y


@pytest.fixture
def trained_model():
    """OncologyPriorityModel trained with minimal synthetic data."""
    model = OncologyPriorityModel()
    X, y = _minimal_train_data()
    model.train(X, y)
    return model


class TestOncologyPriorityModel:

    def test_initial_state_not_trained(self):
        model = OncologyPriorityModel()
        assert model.is_trained is False

    def test_train_sets_is_trained(self, trained_model):
        assert trained_model.is_trained is True

    def test_predict_returns_array_correct_length(self, trained_model):
        X = _make_df([_make_row(age=60, pain_score=3), _make_row(age=70, pain_score=8)])
        result = trained_model.predict(X)
        assert isinstance(result, np.ndarray)
        assert len(result) == 2

    def test_predict_scores_clipped_to_0_100(self, trained_model):
        X = _make_df([_make_row(pain_score=0), _make_row(pain_score=10, ecog_score=4)])
        result = trained_model.predict(X)
        assert np.all(result >= 0)
        assert np.all(result <= 100)

    def test_predict_single_returns_disposition(self, trained_model):
        features = _make_row(age=60, pain_score=9, has_fever=1, in_nadir_window=1)
        result = trained_model.predict_single(features)
        assert "disposition" in result
        assert result["disposition"] in DISPOSITION_CLASSES
        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0
        assert result["source"] == "ml_model"

    def test_predict_single_untrained_returns_fallback(self):
        model = OncologyPriorityModel()
        features = _make_row(pain_score=5)
        result = model.predict_single(features)
        assert result["source"] == "fallback_rules"
        assert result["disposition"] in DISPOSITION_CLASSES

    def test_categorize_priority_critical(self, trained_model):
        assert trained_model.categorize_priority(80.0) == "CRITICAL"
        assert trained_model.categorize_priority(75.0) == "CRITICAL"
        assert trained_model.categorize_priority(100.0) == "CRITICAL"

    def test_categorize_priority_high(self, trained_model):
        assert trained_model.categorize_priority(65.0) == "HIGH"
        assert trained_model.categorize_priority(50.0) == "HIGH"

    def test_categorize_priority_medium(self, trained_model):
        assert trained_model.categorize_priority(40.0) == "MEDIUM"
        assert trained_model.categorize_priority(25.0) == "MEDIUM"

    def test_categorize_priority_low(self, trained_model):
        assert trained_model.categorize_priority(10.0) == "LOW"
        assert trained_model.categorize_priority(0.0) == "LOW"

    def test_save_raises_when_not_trained(self, tmp_path):
        model = OncologyPriorityModel()
        with pytest.raises(ValueError):
            model.save(str(tmp_path / "model.joblib"))

    def test_save_and_load(self, trained_model, tmp_path):
        filepath = str(tmp_path / "test_model.joblib")
        trained_model.save(filepath)

        new_model = OncologyPriorityModel()
        new_model.load(filepath)

        assert new_model.is_trained is True

        X = _make_df([_make_row(age=55, pain_score=5)])
        result = new_model.predict(X)
        assert len(result) == 1

    def test_load_raises_when_file_not_found(self):
        model = OncologyPriorityModel()
        with pytest.raises(FileNotFoundError):
            model.load("/nonexistent/path/model.joblib")

    def test_feature_columns_count(self):
        assert len(FEATURE_COLUMNS) == 32

    def test_disposition_classes_count(self):
        assert len(DISPOSITION_CLASSES) == 5

    def test_disposition_classes_order(self):
        assert DISPOSITION_CLASSES[0] == "REMOTE_NURSING"
        assert DISPOSITION_CLASSES[-1] == "ER_IMMEDIATE"
