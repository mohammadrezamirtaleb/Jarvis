"""
J.A.R.V.I.S. Mark-86 Core Server (Native Windows 11 Desktop Edition)
FastAPI Backend orchestrating 10 AI Providers, Edge TTS, GLM-OCR, Stark Protocols,
Telemetry WebSockets, and Local IPC Bridge.
"""

import json
import time
import os
from pathlib import Path
from urllib.parse import urlparse
from typing import Dict, Any, List, Optional
import asyncio
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from starlette.background import BackgroundTask
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.system_tools import (
    get_system_vitals,
    launch_application,
    open_browser_url,
    capture_desktop_screenshot,
    execute_shell_command,
    search_local_files
)
from core.memory_vault import vault
from core.ocr_engine import extract_ocr_text, analyze_image_with_vision
from core.protocols import PROTOCOLS, execute_protocol
from core.llm_engine import stream_jarvis_chat
from core.providers.registry import provider_registry
from core.conversation_store import init_db, get_all_conversations, get_messages, create_conversation, add_message, delete_conversation
from core.scheduler import scheduler
from core.watcher import init_watcher
from core.tts_engine import generate_tts

app = FastAPI(title="J.A.R.V.I.S. Mark 86 Desktop API", version="86.0.0")

# Allow localhost IPC connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

notification_websockets: List[WebSocket] = []

async def broadcast_notification(payload: dict):
    dead = []
    for ws in notification_websockets[:]:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in notification_websockets:
            notification_websockets.remove(ws)

scheduler.add_notification_callback(broadcast_notification)


@app.on_event("startup")
async def startup_event():
    await init_db()
    scheduler.start()
    init_watcher()


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.stop()


# -----------------------------------------------------------------
# Request Models
# -----------------------------------------------------------------

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    conversation_id: Optional[int] = None


class ProviderTestRequest(BaseModel):
    provider_id: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class OCRRequest(BaseModel):
    image: str
    prompt: Optional[str] = "Extract all text, formulas, and tabular data accurately."
    model: Optional[str] = "glm-ocr:latest"


class ProtocolRequest(BaseModel):
    protocol_id: str


class CommandRequest(BaseModel):
    command: str


class NoteRequest(BaseModel):
    title: str
    content: str


class TTSRequest(BaseModel):
    text: str
    engine: str = "edge"
    voice: str = "en_US-Male"


def cleanup_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


# -----------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------

@app.get("/api/status")
def get_status():
    """Return system online status, active provider, and suite information."""
    prov_cfg = vault.get_provider_config()
    active_prov = prov_cfg.get("active_provider", "openrouter")
    active_model = prov_cfg.get(f"{active_prov}_model", "")
    return {
        "status": "ONLINE",
        "system": "Stark Industries J.A.R.V.I.S. Mark 86",
        "framework": "Windows 11 Fluent Desktop Native",
        "active_provider": active_prov,
        "active_model": active_model,
        "low_token_mode": prov_cfg.get("low_token_mode", True),
        "timestamp": time.time()
    }


@app.get("/api/providers")
def list_providers():
    """List all 10 supported AI providers with user configurations and masked keys."""
    prov_list = provider_registry.list_all()
    prov_cfg = vault.get_provider_config()

    enriched = []
    for p in prov_list:
        pid = p["id"]
        key = prov_cfg.get(f"{pid}_api_key", "")
        masked_key = (key[:6] + "..." + key[-4:]) if (key and len(key) > 10) else ("●●●●●●●●" if key else "")
        current_model = prov_cfg.get(f"{pid}_model", p["default_model"])
        current_base_url = prov_cfg.get(f"{pid}_base_url", p["default_base_url"])

        enriched.append({
            **p,
            "has_key": bool(key),
            "masked_key": masked_key,
            "configured_model": current_model,
            "configured_base_url": current_base_url,
            "is_active": (prov_cfg.get("active_provider", "openrouter").lower() == pid.lower())
        })

    return {
        "providers": enriched,
        "active_provider": prov_cfg.get("active_provider", "openrouter"),
        "global_config": {
            "max_tokens": prov_cfg.get("max_tokens", 1500),
            "temperature": prov_cfg.get("temperature", 0.7),
            "low_token_mode": prov_cfg.get("low_token_mode", True)
        }
    }


@app.post("/api/providers/test")
async def test_provider_connection(req: ProviderTestRequest):
    """Test latency and handshake for any provider."""
    prov_cfg = vault.get_provider_config()
    target_key = req.api_key or prov_cfg.get(f"{req.provider_id}_api_key")
    target_base_url = req.base_url or prov_cfg.get(f"{req.provider_id}_base_url")
    target_model = req.model or prov_cfg.get(f"{req.provider_id}_model")

    success, message, latency_ms = await provider_registry.test_connection(
        provider_id=req.provider_id,
        api_key=target_key,
        base_url=target_base_url,
        model=target_model
    )
    return {
        "success": success,
        "message": message,
        "latency_ms": latency_ms,
        "provider": req.provider_id
    }


@app.get("/api/providers/{provider_id}/models")
async def get_provider_models(provider_id: str):
    """Fetch model catalogue for a specific provider."""
    prov_cfg = vault.get_provider_config()
    key = prov_cfg.get(f"{provider_id}_api_key")
    base_url = prov_cfg.get(f"{provider_id}_base_url")
    models = await provider_registry.get_models(provider_id, api_key=key, base_url=base_url)
    return {"provider": provider_id, "models": models}


@app.post("/api/config/provider")
async def update_provider_config(req: Request):
    data = await req.json()
    vault.update_provider_config(data)
    return {"success": True, "config": vault.get_provider_config()}


@app.post("/api/config/update")
async def update_config_post(req: Request):
    data = await req.json()
    vault.update_provider_config(data)
    return {"success": True, "config": vault.get_provider_config()}


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """Server-Sent Events streaming chat endpoint across all 10 providers."""
    prov_cfg = vault.get_provider_config()
    provider = req.provider or prov_cfg.get("active_provider", "openrouter")
    model = req.model or prov_cfg.get(f"{provider}_model")
    api_key = req.api_key or prov_cfg.get(f"{provider}_api_key")
    base_url = req.base_url or prov_cfg.get(f"{provider}_base_url")
    max_tokens = req.max_tokens or prov_cfg.get("max_tokens", 1500)
    temperature = req.temperature or prov_cfg.get("temperature", 0.7)

    async def event_generator():
        async for chunk in stream_jarvis_chat(
            req.messages,
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
            max_tokens=max_tokens,
            temperature=temperature
        ):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                req = json.loads(data)
            except Exception:
                continue

            prov_cfg = vault.get_provider_config()
            messages = req.get("messages", [])
            provider = req.get("provider") or prov_cfg.get("active_provider", "openrouter")
            cid = req.get("conversation_id")
            model = req.get("model") or prov_cfg.get(f"{provider}_model")
            api_key = req.get("api_key") or prov_cfg.get(f"{provider}_api_key")
            base_url = req.get("base_url") or prov_cfg.get(f"{provider}_base_url")

            if cid:
                last_msg = messages[-1] if messages else None
                if last_msg and last_msg.get("role") == "user":
                    await add_message(cid, "user", last_msg["content"])

            full_text = ""
            async for chunk in stream_jarvis_chat(
                messages,
                provider=provider,
                model=model,
                api_key=api_key,
                base_url=base_url
            ):
                if chunk.get("type") == "done":
                    full_text = chunk.get("full_text", "")
                await websocket.send_json(chunk)

            if cid and full_text:
                await add_message(cid, "assistant", full_text)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
            await websocket.close()
        except Exception:
            pass


@app.post("/api/tts")
async def api_generate_tts(req: TTSRequest):
    try:
        filepath = await generate_tts(req.text, req.engine, req.voice)
        return FileResponse(
            filepath,
            media_type="audio/wav" if req.engine == "piper" else "audio/mpeg",
            background=BackgroundTask(cleanup_file, filepath)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/telemetry")
@app.get("/api/vitals")
def get_telemetry():
    return get_system_vitals()


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            vitals = await asyncio.to_thread(get_system_vitals)
            await websocket.send_json(vitals)
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    await websocket.accept()
    notification_websockets.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in notification_websockets:
            notification_websockets.remove(websocket)


@app.post("/api/ocr")
def process_ocr(req: OCRRequest):
    return extract_ocr_text(req.image, prompt=req.prompt or "", model=req.model or "glm-ocr:latest")


@app.post("/api/screenshot")
def take_screenshot():
    return capture_desktop_screenshot()


@app.get("/api/protocols")
def get_protocols():
    return list(PROTOCOLS.values())


@app.post("/api/protocols/execute")
@app.post("/api/protocol/execute")
def run_protocol(req: ProtocolRequest):
    return execute_protocol(req.protocol_id)


@app.get("/api/conversations")
async def api_get_conversations():
    return await get_all_conversations()


@app.post("/api/conversations")
async def api_create_conversation(req: Request):
    data = await req.json()
    title = data.get("title", "New Session")
    cid = await create_conversation(title)
    return {"id": cid, "title": title}


@app.get("/api/conversations/{cid}")
async def api_get_conversation(cid: int):
    return await get_messages(cid)


@app.delete("/api/conversations/{cid}")
async def api_delete_conversation(cid: int):
    await delete_conversation(cid)
    return {"success": True}


@app.get("/api/vault")
def get_vault():
    data = vault.get_all()
    data = json.loads(json.dumps(data))
    for k, v in data.get("provider_config", {}).items():
        if ("key" in k or "api_key" in k) and isinstance(v, str) and v:
            data["provider_config"][k] = f"****{v[-4:]}" if len(v) > 4 else "****"
    return data


@app.post("/api/vault/note")
def create_note(req: NoteRequest):
    return vault.add_note(req.title, req.content)


@app.delete("/api/vault/note/{note_id}")
def remove_note(note_id: int):
    success = vault.delete_note(note_id)
    return {"success": success}


@app.post("/api/command")
def run_command(req: CommandRequest, request: Request):
    client_host = request.client.host if request.client else ""
    if client_host not in ["127.0.0.1", "localhost", "::1", "testclient"]:
        raise HTTPException(status_code=403, detail="Forbidden: Commands can only be executed from localhost.")
    origin = request.headers.get("origin")
    if origin:
        parsed_origin = urlparse(origin)
        if parsed_origin.hostname not in ["127.0.0.1", "localhost", "::1"]:
            raise HTTPException(status_code=403, detail="Forbidden: Origin not allowed.")
    return execute_shell_command(req.command)


# Serve UI static files
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print(">>> J.A.R.V.I.S. Mark-86 Core (Windows 11 Native Engine) starting on http://127.0.0.1:8000 ...")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
