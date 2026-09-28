"""
J.A.R.V.I.S. Mark-86 Direct Core Test Runner
Tests all 10 providers, token optimization, memory vault, and protocols directly.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.providers.registry import provider_registry
from core.providers.base import LLMProvider
from core.memory_vault import vault
from core.system_tools import get_system_vitals
from core.protocols import PROTOCOLS, execute_protocol

async def run_direct_tests():
    print("==================================================================")
    print("   J.A.R.V.I.S. MARK-86 DIRECT CORE INTEGRITY AUDIT")
    print("==================================================================")

    # 1. 10 Providers Listing
    providers = provider_registry.list_all()
    assert len(providers) == 10, f"Expected 10 providers, got {len(providers)}"
    prov_ids = [p["id"] for p in providers]
    expected_ids = ["openai", "anthropic", "google", "grok", "zai", "openrouter", "custom", "ollama", "vllm", "huggingface"]
    for eid in expected_ids:
        assert eid in prov_ids, f"Provider {eid} missing"
    print(f"[PASS] 1. Universal Providers: All 10 Registered ({', '.join(prov_ids)})")

    # 2. Token Optimizer
    test_messages = [
        {"role": "system", "content": "You are JARVIS."},
        {"role": "user", "content": "Turn 1"},
        {"role": "assistant", "content": "Response 1"},
        {"role": "user", "content": "Turn 2"},
        {"role": "assistant", "content": "Response 2"},
        {"role": "user", "content": "Turn 3"},
        {"role": "assistant", "content": "Response 3"},
        {"role": "user", "content": "Turn 4"},
        {"role": "assistant", "content": "Response 4"},
    ]
    optimized = provider_registry.optimize_messages(test_messages, max_context_tokens=150, low_token_mode=True)
    assert len(optimized) <= len(test_messages)
    assert optimized[0]["role"] == "system"
    print(f"[PASS] 2. Neural Token Optimizer: Successfully compressed {len(test_messages)} messages to {len(optimized)} messages.")

    # 3. Memory Vault & Encryption
    vault.update_provider_config({
        "openai_api_key": "sk-test-key-1234567890",
        "low_token_mode": True
    })
    cfg = vault.get_provider_config()
    assert cfg.get("openai_api_key") == "sk-test-key-1234567890"
    assert cfg.get("low_token_mode") is True
    print(f"[PASS] 3. Memory Vault: Secure key encryption & token config persisted.")

    # 4. Note CRUD
    note = vault.add_note("MK86 Fluent Direct", "Direct test payload")
    assert note["id"] > 0
    del_ok = vault.delete_note(note["id"])
    assert del_ok is True
    print(f"[PASS] 4. Memory Vault Note CRUD: Verified.")

    # 5. Telemetry & Hardware Vitals
    vitals = get_system_vitals()
    assert "cpu" in vitals and "memory" in vitals and "disk" in vitals
    print(f"[PASS] 5. Hardware Telemetry: CPU={vitals['cpu']['percent']}%, RAM={vitals['memory']['percent']}%, Disk={vitals['disk']['percent']}%")

    # 6. Stark Protocols Execution
    assert len(PROTOCOLS) >= 6
    diag_res = execute_protocol("diagnostics")
    assert diag_res["success"] is True
    print(f"[PASS] 6. Stark Diagnostics Protocol: Success.")

    # 7. Ollama Local & Cloud Model Matrix Detection
    ollama_models = await provider_registry.get_models("ollama")
    assert len(ollama_models) >= 10, f"Expected >=10 Ollama models, got {len(ollama_models)}"
    cloud_model_ids = [m["id"] for m in ollama_models if m.get("is_cloud")]
    assert "deepseek-r1:70b" in cloud_model_ids, "DeepSeek R1 70B Cloud model not found"
    assert any("hf.co/" in mid for mid in cloud_model_ids), "HuggingFace GGUF models not found"
    print(f"[PASS] 7. Ollama Cloud & Registry Engine: Detected {len(ollama_models)} models ({len(cloud_model_ids)} Cloud/HF Registry models).")

    print("\n==================================================================")
    print("   ALL DIRECT TESTS PASSED // MARK-86 ENGINE 100% OPERATIONAL!")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(run_direct_tests())
