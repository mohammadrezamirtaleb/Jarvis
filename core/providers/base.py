"""
J.A.R.V.I.S. Base LLM Provider Definition
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple
import time


class ProviderResponseChunk:
    """Represents a streaming chunk from an LLM."""
    def __init__(self, chunk_type: str, token: str = "", full_text: str = "", actions: list = None, error: str = ""):
        self.chunk_type = chunk_type  # "token", "done", "error", "thinking"
        self.token = token
        self.full_text = full_text
        self.actions = actions or []
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        d = {"type": self.chunk_type}
        if self.token:
            d["token"] = self.token
        if self.full_text:
            d["full_text"] = self.full_text
        if self.actions:
            d["actions"] = self.actions
        if self.error:
            d["error"] = self.error
        return d


class LLMProvider(ABC):
    """Abstract base class for all AI provider adapters."""
    
    id: str = "base"
    name: str = "Base Provider"
    description: str = ""
    default_model: str = ""
    requires_key: bool = True
    default_base_url: str = ""
    is_local: bool = False
    badge: str = "CLOUD"
    icon: str = "hub"

    @abstractmethod
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
        """Stream chat tokens asynchronously."""
        yield {"type": "error", "error": "Not implemented"}

    async def test_connection(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Tuple[bool, str, float]:
        """
        Test provider connectivity and return (success, status_message, latency_ms).
        Default implementation sends a minimal 1-token test prompt.
        """
        start = time.perf_counter()
        try:
            test_messages = [{"role": "user", "content": "ping"}]
            success = False
            first_token_received = False
            err = ""

            async for chunk in self.stream_chat(
                messages=test_messages,
                model=model or self.default_model,
                api_key=api_key,
                base_url=base_url,
                max_tokens=5,
                temperature=0.1
            ):
                if chunk.get("type") in ("token", "thinking"):
                    first_token_received = True
                elif chunk.get("type") == "done":
                    success = True
                    break
                elif chunk.get("type") == "error":
                    err = chunk.get("error", "Unknown error")
                    break

            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            if err:
                return False, err, latency_ms
            if success or first_token_received:
                return True, f"Connection OK ({latency_ms}ms)", latency_ms
            return False, "No response received", latency_ms

        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            return False, f"Connection failed: {str(e)}", latency_ms

    async def list_models(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Return available models for this provider."""
        return [{"id": self.default_model, "name": self.default_model, "provider": self.id}]

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Approximate token estimation for low-token budgeting."""
        if not text:
            return 0
        # Persian / Arabic / CJK character weighting
        non_ascii_count = sum(1 for c in text if ord(c) > 127)
        ascii_count = len(text) - non_ascii_count
        return int((ascii_count / 3.8) + (non_ascii_count / 1.5))
