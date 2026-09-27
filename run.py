"""
J.A.R.V.I.S. Mark-86 Master Launcher
Windows 11 Fluent Design Desktop AI Assistant
"""

import sys
import os
import time
import subprocess
import shutil
import uvicorn


def launch_desktop():
    """Launch Mark-86 Native Windows 11 Desktop Electron App."""
    npm_path = shutil.which("npm") or shutil.which("npm.cmd")
    npx_path = shutil.which("npx") or shutil.which("npx.cmd")

    if npm_path:
        print(">>> [MARK-86]: Launching Native Windows 11 Desktop Shell...")
        try:
            subprocess.run([npm_path, "start"], shell=True)
            return
        except Exception as e:
            print(f">>> [DESKTOP WARNING]: npm start failed: {e}")

    if npx_path:
        try:
            subprocess.run([npx_path, "electron", "."], shell=True)
            return
        except Exception:
            pass

    # Fallback to direct Python FastAPI server
    print(">>> [MARK-86]: Starting Python Server on http://127.0.0.1:8000 ...")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, log_level="info")


if __name__ == "__main__":
    print("==================================================================")
    print("   J.A.R.V.I.S. MARK-86 DESKTOP // WINDOWS 11 FLUENT DESIGN")
    print("   10 Providers: OpenAI, Anthropic, Gemini, Grok, ZAI, OpenRouter,")
    print("   Custom API, Ollama, vLLM, and Hugging Face")
    print("==================================================================")
    launch_desktop()
