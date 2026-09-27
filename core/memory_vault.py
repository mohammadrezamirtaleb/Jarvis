"""
J.A.R.V.I.S. Neural Memory Vault (Mark-86 Unified Edition)
Secure encrypted key storage and neural context engine for all 10 providers.
"""

import copy
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from core.security import encrypt_key, decrypt_key

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
VAULT_FILE = DATA_DIR / "memory_vault.json"

SENSITIVE_KEY_FIELDS = [
    "openrouter_api_key",
    "openai_api_key",
    "anthropic_api_key",
    "google_api_key",
    "grok_api_key",
    "zai_api_key",
    "custom_api_key",
    "vllm_api_key",
    "huggingface_api_key"
]

DEFAULT_PROVIDER_CONFIG = {
    "active_provider": "openrouter",
    "max_tokens": 1500,
    "temperature": 0.7,
    "low_token_mode": True,

    # OpenRouter
    "openrouter_api_key": "",
    "openrouter_model": "google/gemma-4-26b-a4b-it:free",

    # OpenAI
    "openai_api_key": "",
    "openai_model": "gpt-4o-mini",
    "openai_base_url": "https://api.openai.com/v1",

    # Anthropic
    "anthropic_api_key": "",
    "anthropic_model": "claude-3-5-haiku-20241022",
    "anthropic_base_url": "https://api.anthropic.com/v1",

    # Google Gemini
    "google_api_key": "",
    "google_model": "gemini-2.5-flash",
    "google_base_url": "https://generativelanguage.googleapis.com/v1beta",

    # Grok (xAI)
    "grok_api_key": "",
    "grok_model": "grok-2-latest",
    "grok_base_url": "https://api.x.ai/v1",

    # ZAI (Zhipu / GLM)
    "zai_api_key": "",
    "zai_model": "glm-4-flash",
    "zai_base_url": "https://open.bigmodel.cn/api/paas/v4",

    # Custom Provider
    "custom_api_key": "",
    "custom_model": "custom-model",
    "custom_base_url": "http://localhost:1234/v1",

    # Ollama Local
    "ollama_model": "qwen3.5:4b",
    "ollama_base_url": "http://localhost:11434",

    # vLLM
    "vllm_api_key": "",
    "vllm_model": "default",
    "vllm_base_url": "http://localhost:8000/v1",

    # Hugging Face
    "huggingface_api_key": "",
    "huggingface_model": "Qwen/Qwen2.5-72B-Instruct",
    "huggingface_base_url": "https://router.huggingface.co/hf-inference/v1",
}

DEFAULT_VAULT = {
    "user_profile": {
        "callsign": "Sir",
        "title": "Chief Architect & Stark Commander",
        "primary_language": "Persian & English",
        "system_version": "Mark LXXXVI (Native Windows 11)",
        "theme": "Stark Arc Blue & Gold"
    },
    "provider_config": DEFAULT_PROVIDER_CONFIG,
    "notes": [
        {
            "id": 1,
            "title": "Mark 86 Fluent Engine Online",
            "content": "Windows 11 Native desktop HUD initialized. Universal 10-provider multi-link established.",
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
    ],
    "learned_facts": [
        "J.A.R.V.I.S. Mark 86 runs as a native Windows 11 Fluent application with Acrylic & Mica glass aesthetics.",
        "Universal AI engine connects to OpenAI, Anthropic, Google Gemini, Grok, ZAI, OpenRouter, Custom APIs, Ollama, vLLM, and HuggingFace.",
        "Real-time token budgeting and low-token sliding window context optimization are active."
    ],
    "protocols": []
}


class MemoryVault:
    def __init__(self):
        self.file_path = VAULT_FILE
        self._load()

    def _load(self):
        if not self.file_path.exists():
            self.data = copy.deepcopy(DEFAULT_VAULT)
            self._save()
        else:
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                    
                    # Merge default provider keys if missing
                    prov_cfg = self.data.setdefault("provider_config", copy.deepcopy(DEFAULT_PROVIDER_CONFIG))
                    for k, v in DEFAULT_PROVIDER_CONFIG.items():
                        if k not in prov_cfg:
                            prov_cfg[k] = v

                    # Decrypt all sensitive API keys into memory
                    for field in SENSITIVE_KEY_FIELDS:
                        if field in prov_cfg:
                            enc_val = prov_cfg[field]
                            if enc_val and isinstance(enc_val, str) and enc_val.startswith("encrypted:"):
                                prov_cfg[field] = decrypt_key(enc_val)
            except Exception as e:
                print(f"[VAULT] Warning: Could not load vault file: {e}. Using defaults.")
                self.data = copy.deepcopy(DEFAULT_VAULT)

    def _save(self):
        save_data = json.loads(json.dumps(self.data))
        prov_cfg = save_data.get("provider_config", {})

        # Encrypt all sensitive keys before writing to disk
        for field in SENSITIVE_KEY_FIELDS:
            if field in prov_cfg:
                plain_val = prov_cfg[field]
                if plain_val and isinstance(plain_val, str) and not plain_val.startswith("encrypted:"):
                    prov_cfg[field] = encrypt_key(plain_val)

        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(save_data, f, ensure_ascii=False, indent=2)

    def get_all(self) -> Dict[str, Any]:
        return self.data

    def get_user_profile(self) -> Dict[str, Any]:
        return self.data.get("user_profile", {})

    def update_user_profile(self, profile: Dict[str, Any]):
        self.data.setdefault("user_profile", {}).update(profile)
        self._save()

    def get_provider_config(self) -> Dict[str, Any]:
        return self.data.get("provider_config", DEFAULT_PROVIDER_CONFIG)

    def update_provider_config(self, config: Dict[str, Any]):
        prov_cfg = self.data.setdefault("provider_config", copy.deepcopy(DEFAULT_PROVIDER_CONFIG))
        prov_cfg.update(config)
        self._save()

    def add_note(self, title: str, content: str) -> Dict[str, Any]:
        notes = self.data.setdefault("notes", [])
        new_id = max([n.get("id", 0) for n in notes], default=0) + 1
        note_entry = {
            "id": new_id,
            "title": title,
            "content": content,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        notes.append(note_entry)
        self._save()
        return note_entry

    def delete_note(self, note_id: int) -> bool:
        notes = self.data.get("notes", [])
        initial_len = len(notes)
        self.data["notes"] = [n for n in notes if n.get("id") != note_id]
        self._save()
        return len(self.data["notes"]) < initial_len

    def add_fact(self, fact: str) -> None:
        facts = self.data.setdefault("learned_facts", [])
        if fact not in facts:
            facts.append(fact)
            self._save()

    def get_context_summary(self) -> str:
        """Produce a compact context block to inject into LLM system prompt with low token overhead."""
        profile = self.data.get("user_profile", {})
        facts = self.data.get("learned_facts", [])
        notes = self.data.get("notes", [])
        
        ctx = [
            f"Commander: {profile.get('callsign', 'Sir')} | Model: {profile.get('system_version', 'Mark 86')}",
        ]
        if facts:
            ctx.append("Directives:")
            for f in facts[-3:]:
                ctx.append(f"- {f}")
        if notes:
            ctx.append("Active Notes:")
            for n in notes[-2:]:
                ctx.append(f"- [{n.get('title')}]: {n.get('content')}")
        return "\n".join(ctx)


vault = MemoryVault()
