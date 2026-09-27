"""
J.A.R.V.I.S. Anthropic Claude Provider Adapter
Supports Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus.
"""

import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional
from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    id = "anthropic"
    name = "Anthropic (Claude)"
    description = "State-of-the-art reasoning: Claude 3.7 Sonnet, Claude 3.5 Sonnet & Haiku."
    default_model = "claude-3-5-haiku-20241022"
    requires_key = True
    default_base_url = "https://api.anthropic.com/v1"
    is_local = False
    badge = "CLOUD // CLAUDE"
    icon = "psychology"

    MODELS = [
        {"id": "claude-3-7-sonnet-20250219", "name": "Claude 3.7 Sonnet (Hybrid Reasoning)", "badge": "HYBRID REASONING"},
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (Coding & Analysis)", "badge": "FLAGSHIP"},
        {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku (Ultra Fast & Efficient)", "badge": "FAST & CHEAP"},
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus (Deep Analysis)", "badge": "DEEP"},
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
            yield {"type": "error", "error": "⚠️ Anthropic API key is missing. Please enter your API key in the AI Providers panel."}
            return

        target_url = (base_url or self.default_base_url).rstrip("/")
        target_model = model or self.default_model

        headers = {
            "x-api-key": target_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        # Separate system message for Anthropic
        system_prompt = ""
        claude_messages = []
        for m in messages:
            content = m.get("content", "")
            if not content:
                continue
            if m.get("role") == "system":
                system_prompt += content + "\n"
            else:
                role = "assistant" if m.get("role") == "assistant" else "user"
                if claude_messages and claude_messages[-1]["role"] == role:
                    prev_text = claude_messages[-1]["content"]
                    claude_messages[-1]["content"] = f"{prev_text}\n{content}" if prev_text else content
                else:
                    claude_messages.append({"role": role, "content": content})

        if not claude_messages:
            claude_messages.append({"role": "user", "content": "Hello"})
        elif claude_messages[0]["role"] != "user":
            claude_messages.insert(0, {"role": "user", "content": "Hello"})

        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": claude_messages,
            "max_tokens": max_tokens,
            "stream": True,
            "temperature": temperature
        }
        if system_prompt.strip():
            payload["system"] = system_prompt.strip()

        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                async with client.stream(
                    "POST",
                    f"{target_url}/messages",
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
                        yield {"type": "error", "error": f"Anthropic Error ({response.status_code}): {err_msg}"}
                        return

                    current_event = ""
                    async for raw_line in response.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if line.startswith("event:"):
                            current_event = line[6:].strip()
                            continue
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            try:
                                event = json.loads(data_str)
                                event_type = event.get("type")
                                
                                if current_event == "error" or event_type == "error":
                                    err_data = event.get("error", event)
                                    err_msg = err_data.get("message", str(err_data)) if isinstance(err_data, dict) else str(err_data)
                                    yield {"type": "error", "error": f"Anthropic Error: {err_msg}"}
                                    return

                                if event_type == "content_block_delta":
                                    delta = event.get("delta", {})
                                    if delta.get("type") == "text_delta":
                                        token = delta.get("text", "")
                                        if token:
                                            full_text += token
                                            yield {"type": "token", "token": token}
                                    elif delta.get("type") == "thinking_delta":
                                        t_token = delta.get("thinking", "")
                                        if t_token:
                                            yield {"type": "thinking", "token": t_token}
                                
                                elif event_type == "message_stop":
                                    break
                            except Exception:
                                pass

                    yield {"type": "done", "full_text": full_text}

        except httpx.ConnectError:
            yield {"type": "error", "error": "⚠️ Cannot connect to Anthropic servers."}
        except Exception as e:
            yield {"type": "error", "error": f"⚠️ Anthropic streaming error: {str(e)}"}

    async def list_models(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        return [{**m, "provider": self.id} for m in self.MODELS]
