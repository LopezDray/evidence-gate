"""Evidence Gate — stop your AI from making up facts about your own data."""
from .core import (
    evidence_gate,
    classify_status,
    derive_allowed_actions,
    validate_rules,
    validate_provenance,
    AUTHORITY_LADDER,
    parse_date,
    days_since,
    freshness_label,
    canonical_json,
    fnv1a64,
    evidence_digest,
    DECISION_SCHEMA,
)
from .verify import verify_claims, citation_block, VERIFICATION_SCHEMA
from . import presets

__all__ = [
    "evidence_gate",
    "classify_status",
    "derive_allowed_actions",
    "validate_rules",
    "validate_provenance",
    "AUTHORITY_LADDER",
    "parse_date",
    "days_since",
    "freshness_label",
    "canonical_json",
    "fnv1a64",
    "evidence_digest",
    "DECISION_SCHEMA",
    "verify_claims",
    "citation_block",
    "VERIFICATION_SCHEMA",
    "presets",
]
__version__ = "1.0.0"
