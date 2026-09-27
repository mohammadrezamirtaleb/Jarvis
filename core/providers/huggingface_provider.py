"""
J.A.R.V.I.S. HuggingFace Inference Provider Adapter
Supports HuggingFace Serverless Inference API & TGI endpoints.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class HuggingFaceProvider(LLMProvider):
    id = "huggingface"
    name = "HuggingFace"
    description = "Serverless access to thousands of open-source models via HuggingFace Hub."
    default_model = "Qwen/Qwen2.5-72B-Instruct"
    requires_key = True
    default_base_url = "https://router.huggingface.co/v1"
    is_local = False
    badge = "CLOUD // HF HUB"
    icon = "token"

    MODELS = [
        {"id": "Qwen/Qwen2.5-72B-Instruct", "name": "Qwen 2.5 72B Instruct", "badge": "FLAGSHIP"},
        {"id": "meta-llama/Llama-3.3-70B-Instruct", "name": "Llama 3.3 70B Instruct", "badge": "OPEN SOURCE"},
        {"id": "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", "name": "DeepSeek R1 Distill Qwen 32B", "badge": "REASONING"},
        {"id": "mistralai/Mistral-7B-Instruct-v0.3", "name": "Mistral 7B Instruct v0.3", "badge": "FAST"},
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
            yield {"type": "error", "error": "⚠️ Hugging Face User Access Token (HF_TOKEN) is missing. Please enter it in the AI Providers panel."}
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
                endpoint = f"{target_url}/chat/completions" if not target_url.endswith("/chat/completions") else target_url
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
                            err_msg = err_data.get("error", raw_err.decode("utf-8"))
                        except Exception:
                            err_msg = raw_err.decode("utf-8")
                        yield {"type": "error", "error": f"HuggingFace Error ({response.status_code}): {err_msg}"}
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
            yield {"type": "error", "error": "⚠️ Cannot connect to HuggingFace servers."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ HuggingFace streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        return [{**m, "provider": self.id} for m in self.MODELS]
