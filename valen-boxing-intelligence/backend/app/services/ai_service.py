"""
AI Corner service layer — Ollama-only provider.

All language-model calls go through this module. The application connects
exclusively to a local Ollama server. There is no OpenAI, Anthropic, or any
other cloud provider dependency.

Architecture note
-----------------
This application runs locally (frontend + backend + Ollama all on the same
machine). The backend calls Ollama at OLLAMA_BASE_URL (default:
http://localhost:11434). Never expose the Ollama port publicly.

Configuration (via backend/.env)
---------------------------------
  OLLAMA_BASE_URL=http://localhost:11434   # Ollama server address
  OLLAMA_MODEL=llama3:latest              # Model must be pulled first

Run `ollama pull <model>` before starting the application.

Supported Ollama models (tested):
  llama3:latest — recommended for general boxing conversations
  qwen2.5-coder:7b — usable but optimised for code
  Any model installed via `ollama pull`

Error codes raised (all HTTP exceptions):
  AI_NOT_CONFIGURED  — OLLAMA_BASE_URL unreachable or model not available
  AI_MODEL_NOT_FOUND — Model named in OLLAMA_MODEL is not installed
  AI_TIMEOUT         — Generation took longer than OLLAMA_TIMEOUT_SECONDS
  AI_API_ERROR       — Any other Ollama error
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Iterator

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration helpers — read from environment every call so hot-reload works
# ---------------------------------------------------------------------------

def _base_url() -> str:
    return os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

def _model() -> str:
    return os.environ.get("OLLAMA_MODEL", "llama3:latest").strip()

def _timeout() -> float:
    try:
        return float(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "120"))
    except ValueError:
        return 120.0


# ---------------------------------------------------------------------------
# Health check — verify Ollama is reachable and the model is available
# ---------------------------------------------------------------------------

def check_ollama_health() -> dict[str, Any]:
    """
    Returns a dict with keys:
      available: bool
      model: str
      model_installed: bool
      error: str | None
    """
    base = _base_url()
    model = _model()

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{base}/api/tags")
            resp.raise_for_status()
            data = resp.json()
    except httpx.ConnectError:
        return {
            "available": False,
            "model": model,
            "model_installed": False,
            "error": f"Cannot connect to Ollama at {base}. Is Ollama running? Run: ollama serve",
        }
    except Exception as exc:
        return {
            "available": False,
            "model": model,
            "model_installed": False,
            "error": f"Ollama health check failed: {exc}",
        }

    installed = [m.get("name", "") for m in data.get("models", [])]
    model_ok = any(m == model or m.startswith(model.split(":")[0]) for m in installed)

    return {
        "available": True,
        "model": model,
        "model_installed": model_ok,
        "installed_models": installed,
        "error": None if model_ok else (
            f"Model '{model}' is not installed. Run: ollama pull {model}. "
            f"Available models: {', '.join(installed) or 'none'}"
        ),
    }


# ---------------------------------------------------------------------------
# Internal: require Ollama is up and model is ready
# ---------------------------------------------------------------------------

def _require_ollama() -> tuple[str, str]:
    """Return (base_url, model) or raise 503."""
    base = _base_url()
    model = _model()

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{base}/api/tags")
            resp.raise_for_status()
            data = resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "AI_NOT_CONFIGURED",
                    "message": (
                        f"Cannot connect to Ollama at {base}. "
                        "Make sure Ollama is running (ollama serve) and "
                        "OLLAMA_BASE_URL is set correctly in backend/.env."
                    ),
                }
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "AI_NOT_CONFIGURED",
                    "message": f"Ollama health check failed: {exc}",
                }
            },
        )

    installed = [m.get("name", "") for m in data.get("models", [])]
    model_ok = any(m == model or m.startswith(model.split(":")[0]) for m in installed)
    if not model_ok:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "AI_MODEL_NOT_FOUND",
                    "message": (
                        f"Model '{model}' is not installed in Ollama. "
                        f"Run: ollama pull {model}. "
                        f"Available: {', '.join(installed) or 'none'}"
                    ),
                }
            },
        )

    return base, model


# ---------------------------------------------------------------------------
# Token budget — trim old messages to stay within context window
# ---------------------------------------------------------------------------

def _trim_messages(messages: list[dict], max_chars: int = 60_000) -> list[dict]:
    """
    Trim the oldest non-system messages when the context is too large.
    System message is always preserved. Local models have smaller context
    windows than cloud APIs, so the default limit is lower (60 k chars).
    """
    total = sum(len(m.get("content", "")) for m in messages)
    if total <= max_chars:
        return messages

    system = [m for m in messages if m["role"] == "system"]
    rest = [m for m in messages if m["role"] != "system"]

    while rest and total > max_chars:
        removed = rest.pop(0)
        total -= len(removed.get("content", ""))

    return system + rest


# ---------------------------------------------------------------------------
# Core chat call (non-streaming)
# ---------------------------------------------------------------------------

def chat_complete(
    messages: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1500,
) -> dict[str, Any]:
    """
    Send a chat completion request to Ollama.
    Returns {'content': str, 'prompt_tokens': int, 'completion_tokens': int}.
    """
    base, model = _require_ollama()
    trimmed = _trim_messages(messages)
    timeout = _timeout()

    payload = {
        "model": model,
        "messages": trimmed,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{base}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException as exc:
        logger.error("Ollama timeout after %.0fs: %s", timeout, exc)
        raise HTTPException(
            status_code=504,
            detail={
                "error": {
                    "code": "AI_TIMEOUT",
                    "message": (
                        f"The AI model took too long to respond (>{timeout:.0f}s). "
                        "Try a shorter message or a faster model. "
                        "Adjust OLLAMA_TIMEOUT_SECONDS in backend/.env."
                    ),
                }
            },
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.error("Ollama HTTP error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_API_ERROR",
                    "message": f"Ollama returned an error: {exc.response.status_code} {exc.response.text[:200]}",
                }
            },
        ) from exc
    except Exception as exc:
        logger.error("Ollama request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_API_ERROR",
                    "message": f"Ollama request failed: {exc}",
                }
            },
        ) from exc

    content = data.get("message", {}).get("content", "")
    prompt_tokens = data.get("prompt_eval_count", 0)
    completion_tokens = data.get("eval_count", 0)

    return {
        "content": content,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
    }


# ---------------------------------------------------------------------------
# Streaming chat call (Server-Sent Events)
# ---------------------------------------------------------------------------

def chat_stream(
    messages: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1500,
) -> Iterator[str]:
    """
    Yield text chunks from a streaming Ollama chat completion.
    Each yielded value is a plain text delta string.
    """
    base, model = _require_ollama()
    trimmed = _trim_messages(messages)
    timeout = _timeout()

    payload = {
        "model": model,
        "messages": trimmed,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            with client.stream("POST", f"{base}/api/chat", json=payload) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("message", {}).get("content", "")
                    if delta:
                        yield delta
                    if chunk.get("done", False):
                        break
    except httpx.TimeoutException as exc:
        logger.error("Ollama stream timeout: %s", exc)
        raise HTTPException(
            status_code=504,
            detail={
                "error": {
                    "code": "AI_TIMEOUT",
                    "message": f"The AI stream timed out after {timeout:.0f}s.",
                }
            },
        ) from exc
    except Exception as exc:
        logger.error("Ollama stream error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_API_ERROR",
                    "message": f"Ollama streaming failed: {exc}",
                }
            },
        ) from exc


# ---------------------------------------------------------------------------
# Structured JSON output
# ---------------------------------------------------------------------------

def chat_structured(
    messages: list[dict[str, str]],
    schema_description: str,
    temperature: float = 0.3,
    max_tokens: int = 2000,
) -> dict[str, Any]:
    """
    Request a JSON-structured response from Ollama.
    Returns {'data': parsed_dict, 'prompt_tokens': int, 'completion_tokens': int}.

    Attempts to use Ollama's native JSON format mode if available.
    Falls back to prompt engineering + manual parsing.
    """
    base, model = _require_ollama()
    trimmed = _trim_messages(messages)
    timeout = _timeout()

    # Prepend a system message that demands JSON only
    json_system = {
        "role": "system",
        "content": (
            "You MUST respond with valid JSON only. "
            "Do not include any markdown code fences, explanations, or text outside the JSON. "
            f"Required schema: {schema_description}"
        ),
    }
    augmented = [json_system] + trimmed

    payload = {
        "model": model,
        "messages": augmented,
        "stream": False,
        "format": "json",  # Ollama JSON mode — forces JSON output when supported
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{base}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail={"error": {"code": "AI_TIMEOUT", "message": f"Structured AI call timed out after {timeout:.0f}s."}},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "AI_API_ERROR", "message": f"Ollama structured call failed: {exc}"}},
        ) from exc

    content = data.get("message", {}).get("content", "").strip()

    # Strip possible markdown fences (some models ignore format=json)
    if content.startswith("```"):
        parts = content.split("```")
        # Try the second part (inside fence)
        for part in parts[1:]:
            candidate = part.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            if candidate:
                content = candidate
                break

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_INVALID_JSON",
                    "message": "The AI model returned a response that could not be parsed as JSON.",
                    "raw": content[:500],
                }
            },
        ) from exc

    return {
        "data": parsed,
        "prompt_tokens": data.get("prompt_eval_count", 0),
        "completion_tokens": data.get("eval_count", 0),
    }
