"""Evidence Gate — stop your AI from making up facts about your own data."""
from .core import (
    evidence_gate,
    classify_status,
    derive_allowed_actions,
    parse_date,
    days_since,
    freshness_label,
)
from . import presets

__all__ = [
    "evidence_gate",
    "classify_status",
    "derive_allowed_actions",
    "parse_date",
    "days_since",
    "freshness_label",
    "presets",
]
__version__ = "0.1.0"
