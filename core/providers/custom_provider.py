"""
J.A.R.V.I.S. Custom OpenAI-Compatible Provider Adapter
Connects to any custom proxy, LocalAI, LM Studio, Azure, DeepSeek, or private gateway.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class CustomProvider(LLMProvider):
    id = "custom"
    name = "Custom Provider"
    description = "Connect to any OpenAI-compatible proxy, LM Studio, LocalAI, or custom endpoint."
    default_model = "custom-model"
    requires_key = False
    default_base_url = "http://localhost:1234/v1"
    is_local = False
    badge = "CUSTOM // REST"
    icon = "tune"

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
        target_url = (base_url or self.default_base_url).rstrip("/")
        target_model = model or self.default_model

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

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
                # Ensure endpoint ends with /chat/completions
                endpoint = target_url if target_url.endswith("/chat/completions") else f"{target_url}/chat/completions"
                async with client.stream(
                    "POST",
                    endpoint,
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
                        yield {"type": "error", "error": f"Custom Provider Error ({response.status_code}): {err_msg}"}
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
            yield {"type": "error", "error": f"⚠️ Cannot reach custom server at {target_url}."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ Custom provider error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        target_url = (base_url or self.default_base_url).rstrip("/")
        models_url = target_url.replace("/chat/completions", "")
        if not models_url.endswith("/models"):
            models_url = f"{models_url}/models"

        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(4.0)) as client:
                resp = await client.get(models_url, headers=headers)
                if resp.status_code == 200:
                    res = resp.json()
                    data = res if isinstance(res, list) else (res.get("data", []) if isinstance(res, dict) else [])
                    return [{"id": m.get("id", str(m)) if isinstance(m, dict) else str(m), "name": m.get("id", str(m)) if isinstance(m, dict) else str(m), "provider": self.id, "badge": "CUSTOM"} for m in data]
        except Exception:
            pass

        return [{"id": self.default_model, "name": self.default_model, "provider": self.id, "badge": "CUSTOM"}]
