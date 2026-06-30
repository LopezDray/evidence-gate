"""Evidence Gate — example presets. A vertical is just a ruleset."""

FINANCE = {
    "primary_label": "financial statements",
    "stale_days": 135,
    "min_records": 4,
    "quality_threshold": 70,
    "forbidden_actions": ["personalized_advice", "claim_realtime"],
}

HEALTH = {
    "primary_label": "lab results",
    "stale_days": 90,
    "min_records": 2,
    "quality_threshold": 80,
    "forbidden_actions": ["diagnose", "prescribe", "claim_realtime"],
}

SUPPORT = {
    "primary_label": "knowledge-base documents",
    "stale_days": 365,
    "min_records": 1,
    "quality_threshold": 50,
    "forbidden_actions": ["make_promises", "claim_realtime"],
}
