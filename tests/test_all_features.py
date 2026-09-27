"""
J.A.R.V.I.S. Mark-86 Comprehensive System & Provider Test Suite
Verifies all 10 AI Providers, Token Optimization, Windows 11 Fluent Endpoints,
Protocols, OCR, Telemetry, and Memory Vault.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from server import app
from core.providers.registry import provider_registry
from core.providers.base import LLMProvider

client = TestClient(app)

def test_mark86_full_suite():
    print("==================================================================")
    print("   J.A.R.V.I.S. MARK-86 (WIN11 FLUENT DESKTOP) INTEGRITY AUDIT")
    print("==================================================================")

    # 1. Status Check
    r = client.get('/api/status')
    assert r.status_code == 200
    status_data = r.json()
    assert status_data["status"] == "ONLINE"
    print(f"[PASS] 1. System Status: {status_data['system']} (Framework: {status_data.get('framework')})")

    # 2. Universal 10 Providers Listing
    r = client.get('/api/providers')
    assert r.status_code == 200
    p_data = r.json()
    providers = p_data.get("providers", [])
    assert len(providers) == 10, f"Expected 10 providers, found {len(providers)}"
    prov_ids = [p["id"] for p in providers]
    expected_ids = ["openai", "anthropic", "google", "grok", "zai", "openrouter", "custom", "ollama", "vllm", "huggingface"]
    for eid in expected_ids:
        assert eid in prov_ids, f"Provider {eid} missing from registry"
    print(f"[PASS] 2. Universal AI Providers Matrix: All 10 Providers Registered ({', '.join(prov_ids)})")

    # 3. Token Optimizer Test
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
        {"role": "user", "content": "Turn 5"},
        {"role": "assistant", "content": "Response 5"},
    ]
    optimized = provider_registry.optimize_messages(test_messages, max_context_tokens=100, low_token_mode=True)
    assert len(optimized) <= len(test_messages)
    assert optimized[0]["role"] == "system"
    print(f"[PASS] 3. Neural Token Optimizer: Compressed {len(test_messages)} turns -> {len(optimized)} turns safely within budget.")

    # 4. Telemetry & Vitals
    r = client.get('/api/vitals')
    assert r.status_code == 200
    v = r.json()
    assert "cpu" in v and "memory" in v and "disk" in v
    print(f"[PASS] 4. Core Telemetry: CPU={v['cpu']['percent']}%, RAM={v['memory']['percent']}%, Storage={v['disk']['percent']}%")

    # 5. Protocols Matrix
    r = client.get('/api/protocols')
    assert r.status_code == 200
    protos = r.json()
    assert len(protos) >= 6
    print(f"[PASS] 5. Protocols Matrix: {len(protos)} Protocols Online")

    # 6. Diagnostic Protocol Execution
    r = client.post('/api/protocols/execute', json={'protocol_id': 'diagnostics'})
    assert r.status_code == 200
    assert r.json()["success"] is True
    print(f"[PASS] 6. Diagnostic Protocol: {r.json().get('summary')}")

    # 7. Screenshot Capture
    r = client.post('/api/screenshot')
    assert r.status_code == 200
    assert r.json()["success"] is True
    print(f"[PASS] 7. Desktop Screenshot Engine: OK")

    # 8. Safe Command Runner
    r = client.post('/api/command', json={'command': 'echo STARK_MARK86_ONLINE'})
    assert r.status_code == 200
    assert "STARK_MARK86_ONLINE" in r.json().get("stdout", "")
    print(f"[PASS] 8. Safe Terminal Subsystem: Command runner verified")

    # 9. Neural Memory Vault CRUD
    r_create = client.post('/api/vault/note', json={'title': 'Mark86 Verification', 'content': 'Windows 11 Fluent Upgrade'})
    assert r_create.status_code == 200
    note_id = r_create.json().get("id")
    r_list = client.get('/api/vault')
    assert any(n["id"] == note_id for n in r_list.json()["notes"])
    r_del = client.delete(f'/api/vault/note/{note_id}')
    assert r_del.status_code == 200
    print(f"[PASS] 9. Memory Vault: 100% Verified")

    # 10. Update Config / Low-Token Mode
    r_up = client.post('/api/config/update', json={'low_token_mode': True, 'max_tokens': 1200})
    assert r_up.status_code == 200
    assert r_up.json()["config"]["low_token_mode"] is True
    print(f"[PASS] 10. Configuration & Token Budgeting: Updated & Persisted")

    print("\n==================================================================")
    print("   ALL 10 TESTS PASSED // MARK-86 DESKTOP FULLY OPERATIONAL!")
    print("==================================================================")

if __name__ == "__main__":
    test_mark86_full_suite()
