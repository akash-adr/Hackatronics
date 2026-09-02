"""
Tests for the AI suggestion layer.

These never call Gemini: the upstream is stubbed or the key is unset, so the
suite stays fast, offline and free. What is tested is the behaviour this
project owns -- graceful degradation, caching, and the endpoint's separate
rate-limit budget.
"""

import importlib

import ai_suggestions
import dotenv
import rate_limiter
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def _context(**overrides):
    base = {
        "substance": "propane",
        "tank_volume_m3": 500,
        "tank_diameter_m": 8,
        "wind_speed_kmh": 12,
        "wind_dir_deg": 90,
        "humidity_pct": 55,
        "threat_level": "HIGH",
        "fatal_radius_m": 7.8,
        "safe_approach_bearing_deg": 90,
        "safe_approach_standoff_m": 950.4,
    }
    base.update(overrides)
    return base


def test_missing_api_key_returns_graceful_fallback(monkeypatch):
    """No key must mean a plain sentence, never an exception or a 500."""
    monkeypatch.setattr(ai_suggestions, "GEMINI_API_KEY", None)

    result = ai_suggestions.generate_safety_suggestion(_context())

    assert result == ai_suggestions.NOT_CONFIGURED_MESSAGE
    assert isinstance(result, str) and result


def test_upstream_failure_returns_graceful_fallback(monkeypatch):
    """A raising SDK is reported as unavailable, not propagated."""
    monkeypatch.setattr(ai_suggestions, "GEMINI_API_KEY", "test-key")

    def boom(*args, **kwargs):
        raise RuntimeError("upstream exploded")

    monkeypatch.setattr(ai_suggestions.genai, "GenerativeModel", boom)

    assert ai_suggestions.generate_safety_suggestion(_context()) == (
        ai_suggestions.FAILURE_MESSAGE
    )


def test_cache_returns_same_result_for_identical_context(monkeypatch):
    """An identical context must be answered from memory, not paid for twice."""
    ai_suggestions._suggestion_cache.clear()
    calls = []

    def fake_generate(context):
        calls.append(context)
        return f"suggestion #{len(calls)}"

    monkeypatch.setattr(ai_suggestions, "generate_safety_suggestion", fake_generate)

    context = _context()
    result1 = ai_suggestions.generate_safety_suggestion_cached(context)
    result2 = ai_suggestions.generate_safety_suggestion_cached(context)

    assert result1 == result2  # served from cache, not a second API call
    assert len(calls) == 1


def test_cache_misses_on_a_different_scenario(monkeypatch):
    """The cache must key on the SCENARIO -- a real change gets a real call."""
    ai_suggestions._suggestion_cache.clear()
    calls = []

    def fake_generate(context):
        calls.append(context)
        return f"suggestion #{len(calls)}"

    monkeypatch.setattr(ai_suggestions, "generate_safety_suggestion", fake_generate)

    ai_suggestions.generate_safety_suggestion_cached(_context())
    ai_suggestions.generate_safety_suggestion_cached(_context(wind_speed_kmh=45))

    assert len(calls) == 2


def test_expired_cache_entry_is_refetched(monkeypatch):
    """Past the TTL the answer is regenerated rather than served stale."""
    ai_suggestions._suggestion_cache.clear()
    calls = []
    monkeypatch.setattr(
        ai_suggestions,
        "generate_safety_suggestion",
        lambda ctx: calls.append(ctx) or "answer",
    )

    context = _context()
    ai_suggestions.generate_safety_suggestion_cached(context)

    # Age the stored entry past the TTL.
    key = ai_suggestions._cache_key(context)
    value, stored_at = ai_suggestions._suggestion_cache[key]
    ai_suggestions._suggestion_cache[key] = (
        value,
        stored_at - ai_suggestions.CACHE_TTL_SECONDS - 1,
    )

    ai_suggestions.generate_safety_suggestion_cached(context)
    assert len(calls) == 2


def test_endpoint_returns_a_suggestion_string(monkeypatch):
    monkeypatch.setattr(
        ai_suggestions, "generate_safety_suggestion", lambda ctx: "Stay upwind."
    )
    ai_suggestions._suggestion_cache.clear()
    rate_limiter.request_log.clear()

    response = client.post("/api/ai-suggestion", json=_context())

    assert response.status_code == 200
    assert response.json() == {"suggestion": "Stay upwind."}


def test_endpoint_rate_limited_separately_from_compute_endpoint(monkeypatch):
    """
    Hammering the AI endpoint must not consume the compute endpoint's budget.

    The AI limit is also deliberately stricter, because every miss costs money
    upstream while a compute call costs only local CPU.
    """
    monkeypatch.setattr(
        ai_suggestions, "generate_safety_suggestion", lambda ctx: "cached advice"
    )
    ai_suggestions._suggestion_cache.clear()
    rate_limiter.request_log.clear()

    assert rate_limiter.AI_RATE_LIMIT_PER_SECOND < rate_limiter.RATE_LIMIT_PER_SECOND

    # Exhaust the AI budget: distinct payloads so the cache cannot mask it.
    statuses = [
        client.post("/api/ai-suggestion", json=_context(wind_speed_kmh=i)).status_code
        for i in range(rate_limiter.AI_RATE_LIMIT_PER_SECOND + 2)
    ]
    assert 429 in statuses, "the stricter AI budget was never enforced"

    # The compute endpoint, on its own bucket, is still fully available.
    compute = client.post(
        "/api/compute-zone",
        json={
            "substance": "propane",
            "tank_volume_m3": 500,
            "tank_diameter_m": 8,
            "wind_speed_kmh": 12,
            "humidity_pct": 55,
            "hazard_type": "thermal",
            "center_lat": 13.0827,
            "center_lon": 80.2707,
            "wind_dir_deg": 90,
        },
    )
    assert compute.status_code == 200


def test_module_imports_without_a_key(monkeypatch):
    """Importing with no key configured must not raise.

    load_dotenv is stubbed out for the reload: otherwise it re-reads the real
    .env, the key comes back, and this stops testing the missing-key path
    (and starts making a live API call in the unit suite).
    """
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(ai_suggestions, "load_dotenv", lambda *a, **k: False)
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)

    importlib.reload(ai_suggestions)
    try:
        assert ai_suggestions.GEMINI_API_KEY is None
        assert (
            ai_suggestions.generate_safety_suggestion(_context())
            == ai_suggestions.NOT_CONFIGURED_MESSAGE
        )
    finally:
        # Restore the real module state for any test that runs after this one.
        importlib.reload(ai_suggestions)
