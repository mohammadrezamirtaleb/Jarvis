"""
J.A.R.V.I.S. vLLM High-Throughput Engine Provider Adapter
Connects to local or cluster vLLM OpenAI-compatible inference servers.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class VLLMProvider(LLMProvider):
    id = "vllm"
    name = "vLLM Engine"
    description = "Ultra-high throughput GPU inference server running vLLM PagedAttention."
    default_model = "default"
    requires_key = False
    default_base_url = "http://localhost:8000/v1"
    is_local = True
    badge = "VLLM // HIGH SPEED"
    icon = "rocket_launch"

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
                endpoint = f"{target_url}/chat/completions" if not target_url.endswith("/chat/completions") else target_url
                async with client.stream(
                    "POST",
                    endpoint,
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        raw_err = await response.aread()
                        yield {"type": "error", "error": f"vLLM Error ({response.status_code}): {raw_err.decode('utf-8')}"}
                        return

                    async for raw_line in response.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
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
            yield {"type": "error", "error": f"⚠️ Cannot reach vLLM server at {target_url}. Is vLLM running?"}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ vLLM streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        target_url = (base_url or self.default_base_url).rstrip("/")
        models_url = target_url.replace("/chat/completions", "")
        if not models_url.endswith("/models"):
            models_url = f"{models_url}/models"

        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
                resp = await client.get(models_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    return [{"id": m.get("id"), "name": m.get("id"), "provider": self.id, "badge": "VLLM"} for m in data]
        except Exception:
            pass

        return [{"id": "default", "name": "vLLM Active Model", "provider": self.id, "badge": "VLLM"}]
