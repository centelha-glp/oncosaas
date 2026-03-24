#!/usr/bin/env python3
"""
Export anonymized training data from the backend for ML retraining.

Usage:
  python -m scripts.export_training_data --token <admin_jwt> --out data.json
  python -m scripts.export_training_data --token <admin_jwt> --out data.json --all
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s — %(message)s")
logger = logging.getLogger("export_training_data")


def export(backend_url: str, token: str, output_path: str, all_tenants: bool = False):
    url = f"{backend_url}/api/v1/disposition-feedback/export"
    if all_tenants:
        url += "?all=true"

    headers = {"Authorization": f"Bearer {token}"}

    logger.info("Fetching training data from %s...", url)
    try:
        response = httpx.get(url, headers=headers, timeout=30.0)
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as e:
        logger.error("HTTP %d: %s", e.response.status_code, e.response.text)
        sys.exit(1)
    except Exception as e:
        logger.error("Request failed: %s", e)
        sys.exit(1)

    if not data:
        logger.warning("No training data returned. Feedback table may be empty.")
        sys.exit(0)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w") as f:
        json.dump(data, f, indent=2, default=str)

    # Summary
    from collections import Counter
    labels = [row.get("label") for row in data if "label" in row]
    dist = Counter(labels)
    logger.info("Exported %d samples to %s", len(data), output)
    logger.info("Label distribution: %s", dict(sorted(dist.items())))

    print(f"\nExported {len(data)} training samples → {output}")
    print(f"Label distribution: {dict(sorted(dist.items()))}")
    print("\nTo retrain the model:")
    print(f"  python -m scripts.train_model --real {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export training data from backend")
    parser.add_argument("--backend", default="http://localhost:3002", help="Backend URL")
    parser.add_argument("--token", required=True, help="Admin JWT token")
    parser.add_argument("--out", default="data/training_feedback.json", help="Output file path")
    parser.add_argument("--all", action="store_true", dest="all_tenants", help="Export from all tenants (super admin)")
    args = parser.parse_args()

    export(args.backend, args.token, args.out, args.all_tenants)
