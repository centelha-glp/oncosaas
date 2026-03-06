"""
Modelo de ML para priorização de casos oncológicos
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
import joblib
import os


FEATURE_COLUMNS = [
    "cancer_type",
    "stage",
    "performance_status",
    "age",
    "pain_score",
    "nausea_score",
    "fatigue_score",
    "days_since_last_visit",
    "treatment_cycle",
]


class PriorityModel:
    """
    Modelo ensemble para calcular score de prioridade (0-100)
    """
    
    def __init__(self):
        self.model = None
        self.is_trained = False
        
    def _create_ensemble(self):
        """Cria modelo ensemble"""
        rf = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        xgb = XGBRegressor(
            n_estimators=100,
            max_depth=6,
            random_state=42
        )
        lgbm = LGBMRegressor(
            n_estimators=100,
            max_depth=6,
            random_state=42
        )
        
        self.model = VotingRegressor(
            estimators=[('rf', rf), ('xgb', xgb), ('lgbm', lgbm)],
            weights=[0.3, 0.4, 0.3]
        )
    
    def train(self, X: pd.DataFrame, y: pd.Series):
        """
        Treina o modelo com dados de treino
        
        Args:
            X: Features (DataFrame)
            y: Target (Series) - scores de prioridade (0-100)
        """
        if self.model is None:
            self._create_ensemble()
        
        self.model.fit(X, y)
        self.is_trained = True
        
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """
        Prediz score de prioridade
        
        Args:
            X: Features (DataFrame)
            
        Returns:
            Array de scores (0-100)
        """
        if not self.is_trained:
            raise ValueError("Modelo não foi treinado ainda")
        
        predictions = self.model.predict(X)
        # Garantir que scores estão entre 0-100
        predictions = np.clip(predictions, 0, 100)
        return predictions
    
    def categorize_priority(self, score: float) -> str:
        """
        Categoriza score em categoria de prioridade
        
        Args:
            score: Score de prioridade (0-100)
            
        Returns:
            Categoria: 'critico', 'alto', 'medio', 'baixo'
        """
        if score >= 75:
            return 'critico'
        elif score >= 50:
            return 'alto'
        elif score >= 25:
            return 'medio'
        else:
            return 'baixo'
    
    def save(self, filepath: str):
        """Salva modelo treinado"""
        if not self.is_trained:
            raise ValueError("Modelo não foi treinado ainda")
        
        joblib.dump(self.model, filepath)
    
    def load(self, filepath: str):
        """Carrega modelo treinado"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Modelo não encontrado: {filepath}")
        
        self.model = joblib.load(filepath)
        self.is_trained = True


# Instância global do modelo
priority_model = PriorityModel()


