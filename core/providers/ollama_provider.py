"""
J.A.R.V.I.S. Ollama Local Provider Adapter
Supports local models (Qwen 3.5, Llama 3.3, Mistral, DeepSeek-R1, Phi-4) with auto-start daemon.
"""

import json
import subprocess
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class OllamaProvider(LLMProvider):
    id = "ollama"
    name = "Ollama (Local Offline)"
    description = "100% private offline inference on your GPU/CPU via Ollama."
    default_model = "qwen3.5:4b"
    requires_key = False
    default_base_url = "http://localhost:11434"
    is_local = True
    badge = "LOCAL // OFFLINE"
    icon = "memory"

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

        payload = {
            "model": target_model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature,
                "top_p": 0.9,
                "num_predict": max_tokens
            }
        }

        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                async with client.stream("POST", f"{target_url}/api/chat", json=payload) as response:
                    if response.status_code != 200:
                        raw_err = await response.aread()
                        yield {"type": "error", "error": f"Ollama Error ({response.status_code}): {raw_err.decode('utf-8')}"}
                        return

                    async for line in response.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                msg = chunk.get("message", {})
                                content = msg.get("content", "")
                                if content:
                                    full_text += content
                                    yield {"type": "token", "token": content}

                                if chunk.get("done", False):
                                    break
                            except Exception:
                                pass

                    yield {"type": "done", "full_text": full_text}

        except httpx.ConnectError:
            try:
                subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
            yield {
                "type": "error",
                "error": "⚠️ Ollama is not responding on http://localhost:11434.\nAuto-starting Ollama daemon in background. Please retry in a few seconds."
            }
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ Ollama neural link error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        target_url = (base_url or self.default_base_url).rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(2.5)) as client:
                resp = await client.get(f"{target_url}/api/tags")
                if resp.status_code == 200:
                    models = resp.json().get("models", [])
                    return [{
                        "id": m.get("name"),
                        "name": f"{m.get('name')} ({round((m.get('size') or 0)/(1024**3), 1)}GB)",
                        "provider": self.id,
                        "badge": "LOCAL // OFFLINE"
                    } for m in models]
        except Exception:
            pass

        return [
            {"id": "qwen3.5:4b", "name": "Qwen 3.5 4B (Default)", "provider": self.id, "badge": "LOCAL"},
            {"id": "llama3.3:latest", "name": "Llama 3.3", "provider": self.id, "badge": "LOCAL"},
            {"id": "mistral:latest", "name": "Mistral 7B", "provider": self.id, "badge": "LOCAL"}
        ]
