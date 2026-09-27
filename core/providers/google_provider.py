"""
J.A.R.V.I.S. Google Gemini Provider Adapter
Supports Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 1.5 Pro with SSE streaming.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class GoogleProvider(LLMProvider):
    id = "google"
    name = "Google (Gemini)"
    description = "Massive context & high-speed reasoning: Gemini 2.5 Pro/Flash & 2.0 Flash."
    default_model = "gemini-2.0-flash"
    requires_key = True
    default_base_url = "https://generativelanguage.googleapis.com/v1beta"
    is_local = False
    badge = "CLOUD // GEMINI"
    icon = "auto_awesome"

    MODELS = [
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Ultra Fast & Smart)", "badge": "OPTIMIZED"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Deep Multimodal Reasoning)", "badge": "FLAGSHIP"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "badge": "FAST"},
        {"id": "gemini-2.0-flash-thinking-exp-01-21", "name": "Gemini 2.0 Flash Thinking", "badge": "REASONING"},
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
            yield {"type": "error", "error": "⚠️ Google Gemini API key is missing. Please enter your API key in the AI Providers panel."}
            return

        target_model = model or self.default_model
        if target_model.startswith('models/'):
            target_model = target_model[7:]
        base = (base_url or self.default_base_url).rstrip("/")
        url = f"{base}/models/{target_model}:streamGenerateContent?alt=sse&key={target_key}"

        # Convert standard messages to Gemini format
        system_text = ""
        contents = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_text += content + "\n"
            else:
                gemini_role = "model" if role == "assistant" else "user"
                if contents and contents[-1]["role"] == gemini_role:
                    prev_text = contents[-1]["parts"][0].get("text", "")
                    contents[-1]["parts"][0]["text"] = f"{prev_text}\n{content}" if prev_text else content
                else:
                    contents.append({
                        "role": gemini_role,
                        "parts": [{"text": content}]
                    })

        if not contents:
            contents.append({"role": "user", "parts": [{"text": "Hello"}]})
        elif contents[0]["role"] != "user":
            contents.insert(0, {"role": "user", "parts": [{"text": "Hello"}]})

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature
            }
        }
        if system_text.strip():
            payload["systemInstruction"] = {
                "parts": [{"text": system_text.strip()}]
            }

        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                async with client.stream("POST", url, json=payload, headers={"Content-Type": "application/json"}) as response:
                    if response.status_code != 200:
                        raw_err = await response.aread()
                        try:
                            err_data = json.loads(raw_err)
                            err_msg = err_data.get("error", {}).get("message", raw_err.decode("utf-8"))
                        except Exception:
                            err_msg = raw_err.decode("utf-8")
                        yield {"type": "error", "error": f"Gemini Error ({response.status_code}): {err_msg}"}
                        return

                    async for raw_line in response.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            try:
                                chunk = json.loads(data_str)
                                prompt_feedback = chunk.get("promptFeedback", {})
                                block_reason = prompt_feedback.get("blockReason")
                                if block_reason:
                                    yield {"type": "error", "error": f"Google Safety Filter: {block_reason}"}
                                    return

                                candidates = chunk.get("candidates", [])
                                if candidates:
                                    candidate = candidates[0]
                                    finish_reason = candidate.get("finishReason")
                                    if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):
                                        yield {"type": "error", "error": f"Google Safety Filter: {finish_reason}"}
                                        return
                                    content_obj = candidate.get("content", {})
                                    parts = content_obj.get("parts", [])
                                    for p in parts:
                                        token = p.get("text", "")
                                        if token:
                                            full_text += token
                                            yield {"type": "token", "token": token}
                            except Exception:
                                pass

                    yield {"type": "done", "full_text": full_text}

        except httpx.ConnectError:
            yield {"type": "error", "error": "⚠️ Cannot connect to Google Gemini API."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ Gemini streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        return [{**m, "provider": self.id} for m in self.MODELS]
