"""
J.A.R.V.I.S. Ollama Local & Cloud Provider Adapter
Supports local GGUF models, remote Ollama Cloud endpoints, Hugging Face Hub registries,
and automatic on-demand cloud model pulling with live progress & reasoning stream parsing.
"""

import json
import subprocess
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


OLLAMA_CLOUD_REGISTRY_MODELS: List[Dict[str, Any]] = [
    # Reasoning & Thinking Models
    {"id": "deepseek-r1:70b", "name": "DeepSeek R1 (70B) — Cloud Registry", "badge": "CLOUD // REASONING", "is_cloud": True},
    {"id": "deepseek-r1:32b", "name": "DeepSeek R1 (32B) — Cloud Registry", "badge": "CLOUD // REASONING", "is_cloud": True},
    {"id": "deepseek-r1:14b", "name": "DeepSeek R1 (14B) — Cloud Registry", "badge": "CLOUD // REASONING", "is_cloud": True},
    {"id": "deepseek-r1:8b", "name": "DeepSeek R1 (8B) — Cloud Registry", "badge": "CLOUD // REASONING", "is_cloud": True},
    {"id": "deepseek-r1:1.5b", "name": "DeepSeek R1 (1.5B) — Fast Reasoning", "badge": "CLOUD // REASONING", "is_cloud": True},
    # Frontier General & Coding Models
    {"id": "llama3.3:70b", "name": "Meta Llama 3.3 (70B) — Cloud", "badge": "CLOUD // FRONTIER", "is_cloud": True},
    {"id": "llama3.2:3b", "name": "Meta Llama 3.2 (3B) — Lightweight", "badge": "CLOUD // FAST", "is_cloud": True},
    {"id": "llama3.2-vision:11b", "name": "Llama 3.2 Vision (11B) — Multimodal", "badge": "CLOUD // MULTIMODAL", "is_cloud": True},
    {"id": "qwen2.5:72b", "name": "Qwen 2.5 (72B) — Cloud", "badge": "CLOUD // FRONTIER", "is_cloud": True},
    {"id": "qwen2.5-coder:32b", "name": "Qwen 2.5 Coder (32B) — Cloud", "badge": "CLOUD // CODE", "is_cloud": True},
    {"id": "mistral-large:123b", "name": "Mistral Large 2 (123B) — Cloud", "badge": "CLOUD // FRONTIER", "is_cloud": True},
    {"id": "command-r-plus:104b", "name": "Cohere Command R+ (104B) — Cloud", "badge": "CLOUD // ENTERPRISE", "is_cloud": True},
    {"id": "phi4:14b", "name": "Microsoft Phi-4 (14B) — Cloud", "badge": "CLOUD // REASONING", "is_cloud": True},
    {"id": "gemma2:27b", "name": "Google Gemma 2 (27B) — Cloud", "badge": "CLOUD // FRONTIER", "is_cloud": True},
    # Hugging Face Hub Direct GGUF Models
    {"id": "hf.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF", "name": "HF: DeepSeek-R1-Distill-Qwen-14B (GGUF)", "badge": "HUGGINGFACE // GGUF", "is_cloud": True},
    {"id": "hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF", "name": "HF: Llama-3.2-3B-Instruct (GGUF)", "badge": "HUGGINGFACE // GGUF", "is_cloud": True},
    {"id": "hf.co/unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF", "name": "HF: DeepSeek-R1-Distill-Llama-8B (GGUF)", "badge": "HUGGINGFACE // GGUF", "is_cloud": True}
]


class OllamaProvider(LLMProvider):
    id = "ollama"
    name = "Ollama (Local & Cloud)"
    description = "100% private offline inference, Ollama Cloud endpoints, and Hugging Face Hub GGUF registry with auto-pull."
    default_model = "qwen3.5:4b"
    requires_key = False
    default_base_url = "http://localhost:11434"
    is_local = True
    badge = "LOCAL & CLOUD // AUTO-PULL"
    icon = "memory"

    def _build_headers(self, api_key: Optional[str] = None) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if api_key and api_key.strip():
            headers["Authorization"] = f"Bearer {api_key.strip()}"
        return headers

    async def _pull_cloud_model(
        self,
        client: httpx.AsyncClient,
        target_url: str,
        headers: Dict[str, str],
        model_name: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream model pull status from Ollama registry or Hugging Face."""
        yield {
            "type": "thinking",
            "text": f"📥 [OLLAMA CLOUD] Model '{model_name}' not present in local cache.\nInitiating automatic on-demand Cloud pull from registry...\n"
        }
        try:
            async with client.stream(
                "POST",
                f"{target_url}/api/pull",
                json={"name": model_name, "stream": True},
                headers=headers,
                timeout=httpx.Timeout(600.0)
            ) as response:
                if response.status_code != 200:
                    raw_err = await response.aread()
                    yield {
                        "type": "error",
                        "error": f"Ollama Cloud Pull Failed ({response.status_code}): {raw_err.decode('utf-8', errors='replace')}"
                    }
                    return

                last_status = ""
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        status = chunk.get("status", "")
                        completed = chunk.get("completed", 0)
                        total = chunk.get("total", 0)

                        if total > 0:
                            pct = round((completed / total) * 100, 1)
                            mb_done = round(completed / (1024 * 1024), 1)
                            mb_total = round(total / (1024 * 1024), 1)
                            msg = f"⏳ [OLLAMA CLOUD] {status}: {mb_done}MB / {mb_total}MB ({pct}%)"
                        else:
                            msg = f"⏳ [OLLAMA CLOUD] {status}"

                        if msg != last_status:
                            last_status = msg
                            yield {"type": "thinking", "text": f"{msg}\n"}
                    except Exception:
                        pass

                yield {
                    "type": "thinking",
                    "text": f"\n✅ [OLLAMA CLOUD] Successfully pulled '{model_name}'. Initializing neural inference...\n\n"
                }
        except Exception as e:
            yield {
                "type": "error",
                "error": f"⚠️ Failed to pull Ollama Cloud model '{model_name}': {str(e)}"
            }

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
        headers = self._build_headers(api_key)

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
        is_local_host = ("localhost" in target_url or "127.0.0.1" in target_url or "::1" in target_url)

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                async with client.stream("POST", f"{target_url}/api/chat", json=payload, headers=headers) as response:
                    # If model not found (404), attempt on-demand cloud pull
                    if response.status_code == 404:
                        raw_err = await response.aread()
                        err_str = raw_err.decode('utf-8', errors='replace')
                        if "not found" in err_str.lower():
                            # Trigger auto-pull
                            pull_failed = False
                            async for pull_chunk in self._pull_cloud_model(client, target_url, headers, target_model):
                                yield pull_chunk
                                if pull_chunk.get("type") == "error":
                                    pull_failed = True
                                    break
                            
                            if pull_failed:
                                return

                            # Retry chat after successful pull
                            async with client.stream("POST", f"{target_url}/api/chat", json=payload, headers=headers) as retry_resp:
                                if retry_resp.status_code != 200:
                                    retry_err = await retry_resp.aread()
                                    yield {"type": "error", "error": f"Ollama Error ({retry_resp.status_code}): {retry_err.decode('utf-8', errors='replace')}"}
                                    return
                                async for chunk_item in self._process_chat_stream(retry_resp):
                                    yield chunk_item
                            return
                        else:
                            yield {"type": "error", "error": f"Ollama Error (404): {err_str}"}
                            return
                    elif response.status_code != 200:
                        raw_err = await response.aread()
                        yield {"type": "error", "error": f"Ollama Error ({response.status_code}): {raw_err.decode('utf-8', errors='replace')}"}
                        return

                    async for chunk_item in self._process_chat_stream(response):
                        yield chunk_item

        except httpx.ConnectError:
            if is_local_host:
                try:
                    subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
                yield {
                    "type": "error",
                    "error": f"⚠️ Ollama local daemon is not running on {target_url}.\nAuto-starting Ollama background service. Please retry in a few seconds."
                }
            else:
                yield {
                    "type": "error",
                    "error": f"⚠️ Unable to reach Ollama Cloud endpoint at '{target_url}'. Please check your network connection and server URL."
                }
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ Ollama neural link error: {str(e)}"}

    async def _process_chat_stream(self, response: httpx.Response) -> AsyncGenerator[Dict[str, Any], None]:
        """Process streaming tokens and parse thinking/reasoning tags."""
        full_text = ""
        in_thinking_tag = False
        think_buffer = ""

        async for line in response.aiter_lines():
            if not line:
                continue
            try:
                chunk = json.loads(line)
                msg = chunk.get("message", {})
                
                # Direct reasoning/thinking field support
                direct_thinking = msg.get("thinking") or msg.get("reasoning_content") or ""
                if direct_thinking:
                    yield {"type": "thinking", "text": direct_thinking}

                content = msg.get("content", "")
                if content:
                    full_text += content

                    # Parse <think>...</think> blocks for DeepSeek-R1 and thinking models
                    if "<think>" in content:
                        in_thinking_tag = True
                        parts = content.split("<think>", 1)
                        if parts[0]:
                            yield {"type": "token", "token": parts[0]}
                        content = parts[1]

                    if in_thinking_tag:
                        if "</think>" in content:
                            in_thinking_tag = False
                            think_parts = content.split("</think>", 1)
                            if think_parts[0]:
                                yield {"type": "thinking", "text": think_parts[0]}
                            if think_parts[1]:
                                yield {"type": "token", "token": think_parts[1]}
                        else:
                            yield {"type": "thinking", "text": content}
                    else:
                        yield {"type": "token", "token": content}

                if chunk.get("done", False):
                    break
            except Exception:
                pass

        yield {"type": "done", "full_text": full_text}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        """List locally installed Ollama models and discoverable Cloud/Registry models."""
        target_url = (base_url or self.default_base_url).rstrip("/")
        headers = self._build_headers(api_key)
        installed_models = []
        installed_ids = set()

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
                resp = await client.get(f"{target_url}/api/tags", headers=headers)
                if resp.status_code == 200:
                    models = resp.json().get("models", [])
                    for m in models:
                        raw_name = m.get("name") or ""
                        if not raw_name:
                            continue
                        installed_ids.add(raw_name)
                        installed_ids.add(raw_name.split(":")[0])

                        size_bytes = m.get("size") or 0
                        size_gb = round(size_bytes / (1024 ** 3), 1)
                        details = m.get("details") or {}
                        param_size = details.get("parameter_size", "")
                        quant = details.get("quantization_level", "")

                        # Classify model source
                        if "hf.co/" in raw_name:
                            badge = "HUGGINGFACE // GGUF"
                        elif "registry." in raw_name or "/" in raw_name:
                            badge = "CLOUD // REGISTRY"
                        else:
                            badge = "LOCAL // INSTALLED"

                        meta_str = f"({param_size} {quant} • {size_gb}GB)" if (param_size or quant) else f"({size_gb}GB)"
                        display_name = f"{raw_name} {meta_str}"

                        installed_models.append({
                            "id": raw_name,
                            "name": display_name,
                            "provider": self.id,
                            "badge": badge,
                            "is_installed": True
                        })
        except Exception:
            pass

        # If no local models discovered, supply sensible defaults
        if not installed_models:
            installed_models = [
                {"id": "qwen3.5:4b", "name": "Qwen 3.5 4B (Default)", "provider": self.id, "badge": "LOCAL // DEFAULT", "is_installed": True},
                {"id": "llama3.3:latest", "name": "Meta Llama 3.3", "provider": self.id, "badge": "LOCAL", "is_installed": True},
                {"id": "mistral:latest", "name": "Mistral 7B", "provider": self.id, "badge": "LOCAL", "is_installed": True}
            ]
            for im in installed_models:
                installed_ids.add(im["id"])

        # Merge curated Ollama Cloud & Hugging Face models
        cloud_models = []
        for cm in OLLAMA_CLOUD_REGISTRY_MODELS:
            cm_id = cm["id"]
            if cm_id not in installed_ids and cm_id.split(":")[0] not in installed_ids:
                cloud_models.append({
                    "id": cm["id"],
                    "name": cm["name"],
                    "provider": self.id,
                    "badge": cm["badge"],
                    "is_cloud": True
                })

        return installed_models + cloud_models
