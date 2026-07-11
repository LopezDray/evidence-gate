"""Evidence Gate — stop your AI from making up facts about your own data."""
from .core import (
    evidence_gate,
    classify_status,
    derive_allowed_actions,
    validate_rules,
    parse_date,
    days_since,
    freshness_label,
    canonical_json,
    fnv1a64,
    evidence_digest,
    DECISION_SCHEMA,
)
from . import presets

__all__ = [
    "evidence_gate",
    "classify_status",
    "derive_allowed_actions",
    "validate_rules",
    "parse_date",
    "days_since",
    "freshness_label",
    "canonical_json",
    "fnv1a64",
    "evidence_digest",
    "DECISION_SCHEMA",
    "presets",
]
__version__ = "0.1.0"
