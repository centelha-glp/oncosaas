"""
Script para gerar dataset sintético de pacientes oncológicos
Usado para treinar modelo de priorização
"""

import pandas as pd
import numpy as np
from pathlib import Path


def generate_synthetic_dataset(n_samples: int = 1000) -> pd.DataFrame:
    """
    Gera dataset sintético de pacientes oncológicos

    Args:
        n_samples: Número de amostras a gerar

    Returns:
        DataFrame com features e labels
    """
    np.random.seed(42)

    # Features
    data = {
        "cancer_type": np.random.choice(
            [
                "mama",
                "lung",
                "colorectal",
                "prostata",
                "kidney",
                "bladder",
                "testicular",
            ],
            n_samples,
            p=[0.25, 0.20, 0.20, 0.15, 0.08, 0.08, 0.04],  # Distribuição ajustada
        ),
        "stage": np.random.choice(
            ["I", "II", "III", "IV"], n_samples, p=[0.2, 0.3, 0.3, 0.2]
        ),
        "performance_status": np.random.choice(
            [0, 1, 2, 3, 4], n_samples, p=[0.3, 0.3, 0.2, 0.15, 0.05]
        ),
        "age": np.random.normal(60, 15, n_samples).astype(int),
        "pain_score": np.random.choice(
            range(11),
            n_samples,
            p=[0.2, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.03, 0.02],
        ),
        "nausea_score": np.random.choice(range(11), n_samples),
        "fatigue_score": np.random.choice(range(11), n_samples),
        "days_since_last_visit": np.random.exponential(30, n_samples).astype(int),
        "treatment_cycle": np.random.choice(range(1, 9), n_samples),
    }

    df = pd.DataFrame(data)

    # Calcular labels (prioridade) baseado em regras de negócio
    def calculate_priority_score(row):
        score = 0

        # Critérios críticos
        if row["pain_score"] >= 8:
            score += 30
        if row["stage"] == "IV":
            score += 20
        if row["performance_status"] >= 3:
            score += 25
        if row["days_since_last_visit"] > 60:
            score += 15

        # Critérios de alta prioridade
        if row["pain_score"] >= 6:
            score += 15
        if row["nausea_score"] >= 7:
            score += 10
        if row["stage"] == "III":
            score += 10

        # Normalizar para 0-100
        score = min(100, score)

        # Categorizar
        if score >= 75:
            category = "critico"
        elif score >= 50:
            category = "alto"
        elif score >= 25:
            category = "medio"
        else:
            category = "baixo"

        return score, category

    df["priority_score"], df["priority_category"] = zip(
        *df.apply(calculate_priority_score, axis=1)
    )

    return df


if __name__ == "__main__":
    # Gerar dataset
    print("Gerando dataset sintético...")
    df = generate_synthetic_dataset(n_samples=1000)

    # Salvar
    output_dir = Path("data")
    output_dir.mkdir(exist_ok=True)

    output_file = output_dir / "synthetic_patients.csv"
    df.to_csv(output_file, index=False)

    print(f"Dataset gerado: {output_file}")
    print(f"Total de amostras: {len(df)}")
    print(f"\nDistribuição de prioridades:")
    print(df["priority_category"].value_counts())
    print(f"\nEstatísticas do score:")
    print(df["priority_score"].describe())
