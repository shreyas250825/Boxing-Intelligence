"""
AI Corner service layer.

All language-model calls go through this module.
Provider: OpenAI-compatible (default: OpenAI gpt-4o-mini, configurable).
The service gracefully degrades when credentials are absent — it never
returns fake AI responses; it raises a clear configuration error instead.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Generator, Iterator

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider abstraction
# ---------------------------------------------------------------------------

def _get_openai_client():
    """
    Return an OpenAI client or raise a clean 503 if credentials are missing.
    Delay import so the app boots without openai installed.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "AI_NOT_CONFIGURED",
                    "message": (
                        "The AI Corner requires an OpenAI API key. "
                        "Set OPENAI_API_KEY in your backend .env file. "
                        "No fake responses will be shown."
                    ),
                }
            },
        )
    try:
        from openai import OpenAI  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "AI_PACKAGE_MISSING",
                    "message": (
                        "The openai Python package is not installed. "
                        "Run: pip install openai"
                    ),
                }
            },
        ) from exc
    base_url = os.environ.get("OPENAI_BASE_URL", "").strip() or None
    return OpenAI(api_key=api_key, base_url=base_url)


def _get_model() -> str:
    return os.environ.get("AI_MODEL", "gpt-4o-mini").strip()


# ---------------------------------------------------------------------------
# Token budget: only fetch what each companion needs
# ---------------------------------------------------------------------------

def _trim_messages(messages: list[dict], max_chars: int = 80_000) -> list[dict]:
    """
    Trim oldest non-system messages if the context would exceed max_chars.
    System message is always preserved.
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
    Send a chat completion request.
    Returns {'content': str, 'prompt_tokens': int, 'completion_tokens': int}.
    """
    client = _get_openai_client()
    model = _get_model()

    trimmed = _trim_messages(messages)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=trimmed,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        logger.error("OpenAI API error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_API_ERROR",
                    "message": f"AI provider returned an error: {exc}",
                }
            },
        ) from exc

    choice = response.choices[0]
    usage = response.usage
    return {
        "content": choice.message.content or "",
        "prompt_tokens": usage.prompt_tokens if usage else 0,
        "completion_tokens": usage.completion_tokens if usage else 0,
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
    Yield text chunks from a streaming chat completion.
    Each yielded value is a plain text delta string.
    """
    client = _get_openai_client()
    model = _get_model()

    trimmed = _trim_messages(messages)

    try:
        stream = client.chat.completions.create(
            model=model,
            messages=trimmed,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as exc:
        logger.error("OpenAI streaming error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_API_ERROR",
                    "message": f"AI provider streaming error: {exc}",
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
    Request a JSON-structured response.
    Returns parsed dict or raises on invalid JSON.
    """
    system_json_note = {
        "role": "system",
        "content": (
            f"You MUST respond with valid JSON only. No markdown fences. "
            f"Schema: {schema_description}"
        ),
    }
    augmented = [system_json_note] + messages
    result = chat_complete(augmented, temperature=temperature, max_tokens=max_tokens)
    content = result["content"].strip()
    # Strip possible markdown fence
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "AI_INVALID_JSON",
                    "message": "AI returned non-JSON response.",
                    "raw": content[:500],
                }
            },
        ) from exc
    return {
        "data": parsed,
        "prompt_tokens": result["prompt_tokens"],
        "completion_tokens": result["completion_tokens"],
    }
