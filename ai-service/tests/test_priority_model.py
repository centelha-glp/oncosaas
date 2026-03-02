"""
Tests for the PriorityModel class.
"""

import pytest
import numpy as np
import pandas as pd
import sys
import os

# Add the ai-service root to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.models.priority_model import PriorityModel


@pytest.fixture
def trained_model():
    """Provide a PriorityModel instance trained with minimal synthetic data."""
    model = PriorityModel()

    # Minimal synthetic features: pain_score, days_waiting, age, comorbidities
    X = pd.DataFrame({
        'pain_score': [2, 5, 8, 9, 1, 7, 3, 6],
        'days_waiting': [3, 14, 30, 45, 1, 28, 7, 21],
        'age': [45, 62, 71, 55, 38, 68, 50, 60],
        'comorbidities': [0, 1, 2, 3, 0, 2, 1, 1],
    })
    y = pd.Series([20, 45, 70, 90, 10, 65, 30, 55])

    model.train(X, y)
    return model


class TestPriorityModel:

    def test_initial_state_not_trained(self):
        model = PriorityModel()
        assert model.is_trained is False

    def test_predict_raises_when_not_trained(self):
        model = PriorityModel()
        X = pd.DataFrame({'a': [1, 2]})
        with pytest.raises(ValueError, match="Modelo não foi treinado"):
            model.predict(X)

    def test_train_sets_is_trained(self, trained_model):
        assert trained_model.is_trained is True

    def test_predict_returns_array_correct_length(self, trained_model):
        X = pd.DataFrame({
            'pain_score': [3, 8],
            'days_waiting': [10, 40],
            'age': [50, 70],
            'comorbidities': [1, 2],
        })
        result = trained_model.predict(X)
        assert isinstance(result, np.ndarray)
        assert len(result) == 2

    def test_predict_scores_clipped_to_0_100(self, trained_model):
        X = pd.DataFrame({
            'pain_score': [0, 10],
            'days_waiting': [0, 100],
            'age': [20, 90],
            'comorbidities': [0, 5],
        })
        result = trained_model.predict(X)
        assert np.all(result >= 0)
        assert np.all(result <= 100)

    def test_categorize_priority_critico(self, trained_model):
        assert trained_model.categorize_priority(80.0) == 'critico'
        assert trained_model.categorize_priority(75.0) == 'critico'
        assert trained_model.categorize_priority(100.0) == 'critico'

    def test_categorize_priority_alto(self, trained_model):
        assert trained_model.categorize_priority(65.0) == 'alto'
        assert trained_model.categorize_priority(50.0) == 'alto'

    def test_categorize_priority_medio(self, trained_model):
        assert trained_model.categorize_priority(40.0) == 'medio'
        assert trained_model.categorize_priority(25.0) == 'medio'

    def test_categorize_priority_baixo(self, trained_model):
        assert trained_model.categorize_priority(10.0) == 'baixo'
        assert trained_model.categorize_priority(0.0) == 'baixo'

    def test_save_raises_when_not_trained(self, tmp_path):
        model = PriorityModel()
        with pytest.raises(ValueError, match="Modelo não foi treinado"):
            model.save(str(tmp_path / 'model.pkl'))

    def test_save_and_load(self, trained_model, tmp_path):
        filepath = str(tmp_path / 'test_model.pkl')
        trained_model.save(filepath)

        new_model = PriorityModel()
        new_model.load(filepath)

        assert new_model.is_trained is True

        X = pd.DataFrame({
            'pain_score': [5],
            'days_waiting': [15],
            'age': [55],
            'comorbidities': [1],
        })
        result = new_model.predict(X)
        assert len(result) == 1

    def test_load_raises_when_file_not_found(self):
        model = PriorityModel()
        with pytest.raises(FileNotFoundError):
            model.load('/nonexistent/path/model.pkl')
