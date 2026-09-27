"""
J.A.R.V.I.S. OpenRouter Universal Provider Adapter
Supports thousands of cloud models with free-tier discovery.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class OpenRouterProvider(LLMProvider):
    id = "openrouter"
    name = "OpenRouter"
    description = "Universal cloud gateway supporting 200+ open & proprietary models."
    default_model = "google/gemma-4-26b-a4b-it:free"
    requires_key = True
    default_base_url = "https://openrouter.ai/api/v1"
    is_local = False
    badge = "CLOUD // UNIVERSAL"
    icon = "hub"

    STATIC_FREE_MODELS = [
        {"id": "google/gemma-4-26b-a4b-it:free", "name": "Google: Gemma 4 26B (Free)", "badge": "CLOUD // FREE"},
        {"id": "google/gemma-4-31b-it:free", "name": "Google: Gemma 4 31B (Free)", "badge": "CLOUD // FREE"},
        {"id": "nvidia/nemotron-3-ultra-550b-a55b:free", "name": "NVIDIA: Nemotron 3 Ultra 550B (Free)", "badge": "CLOUD // FREE"},
        {"id": "nvidia/nemotron-3-super-120b-a12b:free", "name": "NVIDIA: Nemotron 3 Super 120B (Free)", "badge": "CLOUD // FREE"},
        {"id": "nvidia/nemotron-3-nano-30b-a3b:free", "name": "NVIDIA: Nemotron 3 Nano 30B (Free)", "badge": "CLOUD // FREE"},
        {"id": "openai/gpt-oss-20b:free", "name": "OpenAI: GPT-OSS 20B (Free)", "badge": "CLOUD // FREE"},
        {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Meta: Llama 3.3 70B (Free)", "badge": "CLOUD // FREE"},
        {"id": "deepseek/deepseek-r1:free", "name": "DeepSeek: R1 Reasoning (Free)", "badge": "CLOUD // FREE"},
        {"id": "qwen/qwen-2.5-72b-instruct:free", "name": "Qwen: 2.5 72B Instruct (Free)", "badge": "CLOUD // FREE"},
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
            yield {"type": "error", "error": "⚠️ OpenRouter API key is missing. Please enter your API key in the AI Providers panel."}
            return

        target_url = (base_url or self.default_base_url).rstrip("/")
        target_model = model or self.default_model

        headers = {
            "Authorization": f"Bearer {target_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "JARVIS Mark-86 Desktop"
        }

        payload = {
            "model": target_model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

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

                        if response.status_code == 429:
                            yield {
                                "type": "error",
                                "error": f"⚠️ Model `{target_model}` reached temporary cloud rate-limit (429). Please switch to another free model or provider."
                            }
                        else:
                            yield {"type": "error", "error": f"OpenRouter Error ({response.status_code}): {err_msg}"}
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
            yield {"type": "error", "error": "⚠️ Cannot connect to OpenRouter server."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ OpenRouter streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        target_url = (base_url or self.default_base_url).rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(6.0)) as client:
                resp = await client.get(f"{target_url}/models")
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    free_models = []
                    for m in data:
                        mid = m.get("id", "")
                        if ":free" in mid:
                            free_models.append({
                                "id": mid,
                                "name": m.get("name", mid),
                                "provider": self.id,
                                "badge": "CLOUD // FREE"
                            })
                    if free_models:
                        return free_models
        except Exception:
            pass

        return [{**m, "provider": self.id} for m in self.STATIC_FREE_MODELS]
