"""
Centralized clinical numeric thresholds for ESAS / PRO-CTCAE alerts.

Used by protocol_engine and questionnaire_engine — single source of truth.
Do not change values without clinical-domain review.
"""

# ESAS: any single item >= this score → nursing alert
ESAS_ALERT_THRESHOLD = 7

# ESAS: sum of all items >= this → nursing alert
ESAS_TOTAL_ALERT = 50

# PRO-CTCAE: grade >= this → nursing alert
PRO_CTCAE_ALERT_GRADE = 3
