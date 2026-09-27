"""
J.A.R.V.I.S. OpenAI Provider Adapter
Supports GPT-4o, GPT-4o-mini, o1, o3-mini, GPT-4-Turbo with SSE streaming.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    id = "openai"
    name = "OpenAI"
    description = "Industry standard models: GPT-4o, GPT-4o-mini, o1, and o3-mini."
    default_model = "gpt-4o-mini"
    requires_key = True
    default_base_url = "https://api.openai.com/v1"
    is_local = False
    badge = "CLOUD // TIER 1"
    icon = "smart_toy"

    MODELS = [
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Fast & Low Cost)", "badge": "OPTIMIZED"},
        {"id": "gpt-4o", "name": "GPT-4o (Flagship Omni)", "badge": "FLAGSHIP"},
        {"id": "o3-mini", "name": "o3-mini (High Reasoning Speed)", "badge": "REASONING"},
        {"id": "o1", "name": "o1 (Deep Reasoning Flagship)", "badge": "DEEP REASONING"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "badge": "LEGACY"},
    ]

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        target_key = api_key
        if not target_key:
            yield {"type": "error", "error": "⚠️ OpenAI API key is missing. Please enter your API key in the AI Providers panel."}
            return

        target_url = (base_url or self.default_base_url).rstrip("/")
        target_model = model or self.default_model

        headers = {
            "Authorization": f"Bearer {target_key}",
            "Content-Type": "application/json"
        }

        # Handle o1 / o3-mini parameter differences (max_completion_tokens vs max_tokens, temperature)
        is_reasoning = target_model.startswith("o1") or target_model.startswith("o3")
        out_messages = []
        for m in messages:
            if is_reasoning and m.get("role") == "system":
                out_messages.append({**m, "role": "developer"})
            else:
                out_messages.append(m)

        payload = {
            "model": target_model,
            "messages": out_messages,
            "stream": True,
        }

        if is_reasoning:
            payload["max_completion_tokens"] = max_tokens
        else:
            payload["max_tokens"] = max_tokens
            payload["temperature"] = temperature

        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                async with client.stream(
                    "POST",
                    f"{target_url}/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        raw_err = await response.aread()
                        try:
                            err_data = json.loads(raw_err)
                            err_msg = err_data.get("error", {}).get("message", raw_err.decode("utf-8"))
                        except Exception:
                            err_msg = raw_err.decode("utf-8")
                        yield {"type": "error", "error": f"OpenAI Error ({response.status_code}): {err_msg}"}
                        return

                    async for raw_line in response.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if line.startswith(":"):
                            continue
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                if chunk.get("error"):
                                    err_val = chunk["error"]
                                    err_msg = err_val.get("message", str(err_val)) if isinstance(err_val, dict) else str(err_val)
                                    yield {"type": "error", "error": err_msg}
                                    return
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                                    if reasoning:
                                        yield {"type": "thinking", "text": reasoning}
                                    content = delta.get("content", "")
                                    if content:
                                        full_text += content
                                        yield {"type": "token", "token": content}
                            except Exception:
                                pass

                    yield {"type": "done", "full_text": full_text}

        except httpx.ConnectError:
            yield {"type": "error", "error": "⚠️ Cannot connect to OpenAI server. Please check your internet connection."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ OpenAI streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        return [{**m, "provider": self.id} for m in self.MODELS]
