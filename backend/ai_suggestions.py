"""
AI safety-suggestion layer (Google Gemini).

Server-side ONLY. The API key is read from the environment here and never
leaves this process: the browser talks to /api/ai-suggestion, which talks to
Gemini. That is the whole reason this module exists rather than the frontend
calling Gemini directly -- a key shipped to the browser is a published key.

Module 7 discipline applies throughout: a missing key or a failing upstream
degrades to a plain sentence, never to a crash or a 500.
"""

import hashlib
import json
import logging
import os
import time

import concurrent.futures

import google.generativeai as genai
from dotenv import load_dotenv
from google.api_core import retry as google_retry

# Nothing else in the backend loads .env, so this module does it -- otherwise
# a key sitting in backend/.env would be invisible and the feature would
# silently report itself as "not configured".
load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Overridable without a code change: Google retires model names on its own
# schedule, and a retired name is a runtime failure, not a build one.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

# Both raised from the values in the original spec, for measured reasons:
#
# TIMEOUT: 5 s was far too short. Measured latency for this model on this
#   prompt is 6-13 s and highly variable, so 5 s and then 15 s both returned
#   "504 Deadline expired". 30 s clears the observed spread. That is safe here
#   because the call is bounded twice over (retry deadline + hard thread
#   timeout) and the suggestion box is asynchronous UI -- it never sits on the
#   compute path or blocks a zone update.
#
# MAX_OUTPUT_TOKENS: 100 produced EMPTY responses. Gemini 3.x models spend
#   output budget on internal reasoning first, so a 100-token cap was consumed
#   before any visible text existed and response.text raised "requires the
#   response to contain a valid Part". Measured: 400 truncates mid-sentence,
#   1200 completes cleanly. The 1-2 sentence limit is enforced by the PROMPT,
#   which is where it belongs -- the cap is only a runaway guard.
REQUEST_TIMEOUT_SECONDS = int(os.environ.get("GEMINI_TIMEOUT_SECONDS", "30"))
MAX_OUTPUT_TOKENS = int(os.environ.get("GEMINI_MAX_OUTPUT_TOKENS", "1200"))
TEMPERATURE = 0.4

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    # Graceful degradation per Module 7 principles -- feature disabled,
    # not a crash, if the key isn't set.
    logging.warning("GEMINI_API_KEY not set -- AI suggestion feature disabled")

NOT_CONFIGURED_MESSAGE = "AI suggestions unavailable (not configured)."
FAILURE_MESSAGE = "AI suggestion temporarily unavailable."


def generate_safety_suggestion(hazard_context):
    """
    hazard_context: a dict summarizing the CURRENT scenario -- substance,
    tank_volume_m3, tank_diameter_m, wind_speed_kmh, wind_dir_deg, humidity_pct,
    threat_level ("HIGH"/"MEDIUM"/"LOW"), fatal_radius_m, safe_approach_bearing_deg,
    safe_approach_standoff_m.

    Returns a short, actionable safety suggestion string, or a graceful fallback
    message if the API key is missing or the call fails.
    """
    if not GEMINI_API_KEY:
        return NOT_CONFIGURED_MESSAGE

    prompt = f"""You are a safety advisor for an industrial fire/explosion incident response tool.
Given the following live scenario, provide ONE short, specific, actionable safety recommendation
(1-2 sentences maximum, plain language, no markdown formatting, no preamble):

Substance: {hazard_context.get('substance')}
Tank volume: {hazard_context.get('tank_volume_m3')} m³
Tank diameter: {hazard_context.get('tank_diameter_m')} m
Wind: {hazard_context.get('wind_speed_kmh')} km/h from {hazard_context.get('wind_dir_deg')}°
Humidity: {hazard_context.get('humidity_pct')}%
Threat level: {hazard_context.get('threat_level')}
Fatal radius: {hazard_context.get('fatal_radius_m')} m
Recommended safe approach: {hazard_context.get('safe_approach_bearing_deg')}°, standoff {hazard_context.get('safe_approach_standoff_m')} m

Give ONE concise, practical recommendation for a responder or incident commander based on these specific numbers.
Do not repeat the numbers back verbatim -- add genuine operational insight (e.g. about wind trends,
approach timing, equipment considerations, or crew positioning) that isn't already shown elsewhere on the dashboard."""

    def call_gemini():
        model = genai.GenerativeModel(GEMINI_MODEL)
        return model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=MAX_OUTPUT_TOKENS,
                temperature=TEMPERATURE,
            ),
            # `timeout` alone bounds each ATTEMPT, not the call: the SDK's
            # default retry policy kept retrying a 504 and one request held a
            # worker for 247 seconds. The explicit Retry deadline bounds the
            # whole thing including retries.
            request_options={
                "timeout": REQUEST_TIMEOUT_SECONDS,
                "retry": google_retry.Retry(
                    initial=0.5,
                    maximum=2.0,
                    multiplier=2.0,
                    deadline=REQUEST_TIMEOUT_SECONDS,
                ),
            },
        )

    try:
        # Belt and braces: even if the SDK ignores its own deadline, the
        # ENDPOINT returns on time. A stalled upstream must never be the thing
        # that makes the dashboard look broken.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            response = pool.submit(call_gemini).result(
                timeout=REQUEST_TIMEOUT_SECONDS + 2
            )
        # A model can return a candidate with no text part -- reasoning used
        # the whole budget, or a safety filter fired. response.text raises in
        # that case, so it is checked rather than trusted.
        parts = getattr(response.candidates[0].content, "parts", None)
        if not parts:
            logging.warning(
                "Gemini returned no text part (finish_reason=%s)",
                getattr(response.candidates[0], "finish_reason", "unknown"),
            )
            return FAILURE_MESSAGE

        return response.text.strip()
    except concurrent.futures.TimeoutError:
        logging.warning(
            "Gemini suggestion timed out after %ss", REQUEST_TIMEOUT_SECONDS + 2
        )
        return FAILURE_MESSAGE
    except Exception as e:
        logging.warning(f"Gemini suggestion generation failed: {e}")
        return FAILURE_MESSAGE


# --- caching ---------------------------------------------------------------
# Gemini is metered and slow relative to everything else in this backend. The
# frontend's 120 ms debounce still settles many drags on the SAME final
# scenario, so an identical context within the window is answered from memory
# rather than paid for twice.

_suggestion_cache = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(hazard_context):
    return hashlib.md5(
        json.dumps(hazard_context, sort_keys=True, default=str).encode()
    ).hexdigest()


def generate_safety_suggestion_cached(hazard_context):
    key = _cache_key(hazard_context)
    now = time.time()
    if key in _suggestion_cache:
        cached_result, cached_time = _suggestion_cache[key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return cached_result
    result = generate_safety_suggestion(hazard_context)
    _suggestion_cache[key] = (result, now)
    return result
