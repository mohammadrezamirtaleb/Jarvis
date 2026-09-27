@echo off
title J.A.R.V.I.S. Mark-86 Desktop // Windows 11 Native
color 0b
cd /d "%~dp0"

echo ====================================================================
echo   J.A.R.V.I.S. MARK-86 DESKTOP // WINDOWS 11 FLUENT DESIGN SYSTEM
echo   10 AI Providers: OpenAI, Anthropic, Gemini, Grok, ZAI, OpenRouter,
echo   Custom API, Ollama, vLLM, and Hugging Face
echo ====================================================================
echo.
echo [1/1] Launching J.A.R.V.I.S. Native Desktop Shell...

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Could not start via npm. Ensure Node.js and dependencies are installed.
    pause
)
