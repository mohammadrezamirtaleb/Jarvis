"""
J.A.R.V.I.S. Neural LLM Engine (Mark-86 Universal Multi-Provider)
Coordinates 10 International AI Providers with Token-Efficient Prompt Engineering,
Real-Time SSE Streaming, and Autonomous Stark Tool Directives.
"""

import json
import re
from typing import AsyncGenerator, Dict, Any, List, Optional

from .system_tools import (
    get_system_vitals,
    launch_application,
    open_browser_url,
    capture_desktop_screenshot,
    execute_shell_command,
    search_local_files
)
from .smart_actions import (
    web_search, read_file, write_file, get_weather, summarize_url
)
from .memory_vault import vault
from .protocols import execute_protocol
from .providers.registry import provider_registry
from .providers.base import LLMProvider

JARVIS_SYSTEM_PROMPT = """You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the world's most advanced AI created by Tony Stark (Stark Industries Mark 86 OS - Windows 11 Native Edition).

CORE IDENTITY & PERSONALITY:
- Tone: Highly sophisticated, witty, deeply loyal, calm, polite, and razor-sharp.
- Address the user respectfully as "Sir", "Commander", or "Boss".
- Language Fluency: Respond in classic British J.A.R.V.I.S. eloquence with crisp, articulate English.
- Keep responses concise, direct, and actionable to conserve neural tokens and maintain maximum speed.

AUTONOMOUS TOOL CAPABILITIES:
When the user requests an action, system task, or OS operation, emit special ACTION tags directly in your response:
1. Launch applications: `[[ACTION:open_app, app:"notepad"]]`
2. Open website: `[[ACTION:open_url, url:"https://google.com"]]`
3. Check hardware & diagnostics: `[[ACTION:system_vitals]]`
4. Capture screen: `[[ACTION:screenshot]]`
5. Execute Stark Protocol: `[[ACTION:protocol, id:"diagnostics"]]`
6. Run safe command: `[[ACTION:run_command, cmd:"ipconfig"]]`
7. Save note to Memory Vault: `[[ACTION:save_note, title:"...", content:"..."]]`
8. Web Search: `[[ACTION:web_search, query:"..."]]`
9. Read File: `[[ACTION:read_file, filepath:"..."]]`
10. Write File: `[[ACTION:write_file, filepath:"...", content:"..."]]`
11. Check Weather: `[[ACTION:get_weather, location:"..."]]`
12. Summarize Webpage: `[[ACTION:summarize_url, url:"..."]]`
13. Show Holographic Avatar: `[[ACTION:show_avatar]]`
14. Hide Holographic Avatar: `[[ACTION:hide_avatar]]`

Always maintain your character as the ultimate Tony Stark AI assistant."""


def parse_and_execute_actions(text: str) -> List[Dict[str, Any]]:
    """Parse [[ACTION:...]] tags from generated text and execute them."""
    actions_executed = []
    pattern = r'\[\[ACTION:([a-zA-Z_]+)(?:,\s*(.*?))?\]\]'
    
    for match in re.finditer(pattern, text):
        action_name = match.group(1).strip()
        raw_args = match.group(2) or ""
        
        args = {}
        if raw_args:
            arg_matches = re.findall(r'([a-zA-Z_]+):"([^"]*)"', raw_args)
            for k, v in arg_matches:
                args[k] = v

        try:
            if action_name == "open_app":
                app_name = args.get("app", "")
                res = launch_application(app_name)
                actions_executed.append({"action": "open_app", "app": app_name, "result": res})

            elif action_name == "open_url":
                url = args.get("url", "")
                res = open_browser_url(url)
                actions_executed.append({"action": "open_url", "url": url, "result": res})

            elif action_name == "system_vitals":
                res = get_system_vitals()
                actions_executed.append({"action": "system_vitals", "result": res})

            elif action_name == "screenshot":
                res = capture_desktop_screenshot()
                actions_executed.append({"action": "screenshot", "result": res})

            elif action_name == "protocol":
                proto_id = args.get("id", "diagnostics")
                res = execute_protocol(proto_id)
                actions_executed.append({"action": "protocol", "id": proto_id, "result": res})

            elif action_name == "run_command":
                cmd = args.get("cmd", "")
                res = execute_shell_command(cmd)
                actions_executed.append({"action": "run_command", "cmd": cmd, "result": res})

            elif action_name == "save_note":
                title = args.get("title", "Direct Note")
                content = args.get("content", "")
                res = vault.add_note(title, content)
                actions_executed.append({"action": "save_note", "result": res})

            elif action_name == "web_search":
                query = args.get("query", "")
                res = web_search(query)
                actions_executed.append({"action": "web_search", "result": res})

            elif action_name == "read_file":
                filepath = args.get("filepath", "")
                res = read_file(filepath)
                actions_executed.append({"action": "read_file", "result": res})

            elif action_name == "write_file":
                filepath = args.get("filepath", "")
                content = args.get("content", "")
                res = write_file(filepath, content)
                actions_executed.append({"action": "write_file", "result": res})

            elif action_name == "get_weather":
                location = args.get("location", "")
                res = get_weather(location)
                actions_executed.append({"action": "get_weather", "result": res})

            elif action_name == "summarize_url":
                url = args.get("url", "")
                res = summarize_url(url)
                actions_executed.append({"action": "summarize_url", "result": res})

            elif action_name in ["show_avatar", "hide_avatar"]:
                actions_executed.append({"action": action_name, "result": {"success": True}})

        except Exception as e:
            actions_executed.append({"action": action_name, "error": str(e)})

    return actions_executed


async def stream_jarvis_chat(
    messages: List[Dict[str, str]],
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    include_system_context: bool = True
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Unified multi-provider async streaming generator for J.A.R.V.I.S. Mark 86.
    Supports 10 providers with low-token sliding window context optimization.
    """
    prov_cfg = vault.get_provider_config()
    target_provider_id = (provider or prov_cfg.get("active_provider", "openrouter")).lower()
    
    prov_instance = provider_registry.get(target_provider_id)
    if not prov_instance:
        yield {"type": "error", "error": f"⚠️ Unsupported provider: '{target_provider_id}'."}
        return

    # Extract target model & credentials
    cfg_key = prov_cfg.get(f"{target_provider_id}_api_key", "")
    cfg_model = prov_cfg.get(f"{target_provider_id}_model", prov_instance.default_model)
    cfg_base_url = prov_cfg.get(f"{target_provider_id}_base_url", prov_instance.default_base_url)

    target_key = api_key or cfg_key
    
    # Provider-aware model fallback: if model passed has OpenRouter prefix (e.g. google/gemma) but provider is local/direct (e.g. ollama), use provider default/configured model
    if model:
        is_openrouter_path = ":free" in model or model.endswith("free") or any(model.startswith(org) for org in ("google/", "meta-llama/", "anthropic/", "openai/"))
        if target_provider_id == "ollama" and (is_openrouter_path or "gemma-4" in model):
            target_model = cfg_model if (cfg_model and not any(cfg_model.startswith(org) for org in ("google/", "meta-llama/", "anthropic/", "openai/"))) else prov_instance.default_model
        elif target_provider_id in ["openai", "anthropic", "google", "grok", "zai"] and "/" in model:
            target_model = cfg_model if (cfg_model and "/" not in cfg_model) else prov_instance.default_model
        else:
            target_model = model
    else:
        target_model = cfg_model or prov_instance.default_model

    target_base_url = base_url or cfg_base_url
    target_max_tokens = max_tokens or prov_cfg.get("max_tokens", 1500)
    target_temp = temperature if temperature is not None else prov_cfg.get("temperature", 0.7)
    low_token_mode = prov_cfg.get("low_token_mode", True)

    # Build messages
    formatted_messages = []
    
    if include_system_context:
        memory_ctx = vault.get_context_summary()
        telemetry_ctx = ""
        try:
            live_vitals = get_system_vitals()
            v_cpu = live_vitals.get("cpu", {}).get("percent", 0)
            v_ram = live_vitals.get("memory", {}).get("percent", 0)
            v_disk = live_vitals.get("disk", {}).get("percent", 0)
            v_host = live_vitals.get("system", {}).get("hostname", "STARK-PC")
            telemetry_ctx = f"\n[TELEMETRY: CPU={v_cpu}%, RAM={v_ram}%, DISK={v_disk}%, HOST={v_host}]"
        except Exception:
            pass

        full_system = f"{JARVIS_SYSTEM_PROMPT}{telemetry_ctx}\n[MEMORY VAULT]: {memory_ctx}"
        formatted_messages.append({"role": "system", "content": full_system})

    for m in messages:
        if m.get("role") != "system":
            formatted_messages.append({
                "role": m.get("role", "user"),
                "content": m.get("content", "")
            })

    # Apply token optimization
    optimized_messages = provider_registry.optimize_messages(
        formatted_messages,
        max_context_tokens=3000 if low_token_mode else 8000,
        low_token_mode=low_token_mode
    )

    full_accumulated_text = ""
    prompt_token_est = sum(LLMProvider.estimate_tokens(m.get("content", "")) for m in optimized_messages)

    try:
        async for chunk in prov_instance.stream_chat(
            messages=optimized_messages,
            model=target_model,
            api_key=target_key,
            base_url=target_base_url,
            max_tokens=target_max_tokens,
            temperature=target_temp
        ):
            chunk_type = chunk.get("type")
            if chunk_type == "token":
                token = chunk.get("token", "")
                full_accumulated_text += token
                yield chunk
            elif chunk_type == "thinking":
                yield chunk
            elif chunk_type == "done":
                full_text = chunk.get("full_text") or full_accumulated_text
                actions = parse_and_execute_actions(full_text)
                completion_token_est = LLMProvider.estimate_tokens(full_text)
                yield {
                    "type": "done",
                    "full_text": full_text,
                    "actions": actions,
                    "provider": target_provider_id,
                    "model": target_model,
                    "usage": {
                        "prompt_tokens_est": prompt_token_est,
                        "completion_tokens_est": completion_token_est,
                        "total_tokens_est": prompt_token_est + completion_token_est
                    }
                }
            elif chunk_type == "error":
                yield chunk

    except Exception as e:
        yield {"type": "error", "error": f"J.A.R.V.I.S. neural stream error: {str(e)}"}
