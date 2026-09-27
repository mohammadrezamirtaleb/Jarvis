"""
J.A.R.V.I.S. ZAI (Zhipu AI / GLM) Provider Adapter
Supports GLM-4-Plus, GLM-4-Flash, GLM-4V, and GLM-4-Air.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class ZAIProvider(LLMProvider):
    id = "zai"
    name = "ZAI (Zhipu / GLM)"
    description = "High efficiency bilingual reasoning & vision: GLM-4-Plus & GLM-4-Flash."
    default_model = "glm-4-flash"
    requires_key = True
    default_base_url = "https://open.bigmodel.cn/api/paas/v4"
    is_local = False
    badge = "CLOUD // GLM"
    icon = "public"

    MODELS = [
        {"id": "glm-4-flash", "name": "GLM-4 Flash (Ultra Fast & Free)", "badge": "OPTIMIZED"},
        {"id": "glm-4-plus", "name": "GLM-4 Plus (Flagship Intelligence)", "badge": "FLAGSHIP"},
        {"id": "glm-4v-plus", "name": "GLM-4V Plus (Multimodal Vision)", "badge": "VISION"},
        {"id": "glm-4-air", "name": "GLM-4 Air (Balanced Speed)", "badge": "BALANCED"},
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
            yield {"type": "error", "error": "⚠️ ZAI / GLM API key is missing. Please enter your API key in the AI Providers panel."}
            return

        target_url = (base_url or self.default_base_url).rstrip("/")
        target_model = model or self.default_model

        headers = {
            "Authorization": f"Bearer {target_key}",
            "Content-Type": "application/json"
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
                        yield {"type": "error", "error": f"ZAI / GLM Error ({response.status_code}): {err_msg}"}
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
            yield {"type": "error", "error": "⚠️ Cannot connect to ZAI servers."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ ZAI streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        return [{**m, "provider": self.id} for m in self.MODELS]
