"""
J.A.R.V.I.S. Multi-Provider Registry & Token Optimizer
Manages 10 AI providers with dynamic hot-switching, latency testing, and token budgeting.
"""

from typing import Dict, Any, List, Optional, Tuple
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider
from .grok_provider import GrokProvider
from .zai_provider import ZAIProvider
from .openrouter_provider import OpenRouterProvider
from .custom_provider import CustomProvider
from .ollama_provider import OllamaProvider
from .vllm_provider import VLLMProvider
from .huggingface_provider import HuggingFaceProvider


class ProviderRegistry:
    """Central registry and coordinator for all J.A.R.V.I.S. neural providers."""

    def __init__(self):
        self._providers: Dict[str, LLMProvider] = {}
        self._register_defaults()

    def _register_defaults(self):
        providers: List[LLMProvider] = [
            OpenAIProvider(),
            AnthropicProvider(),
            GoogleProvider(),
            GrokProvider(),
            ZAIProvider(),
            OpenRouterProvider(),
            CustomProvider(),
            OllamaProvider(),
            VLLMProvider(),
            HuggingFaceProvider(),
        ]
        for p in providers:
            self._providers[p.id] = p

    def get(self, provider_id: str) -> Optional[LLMProvider]:
        return self._providers.get(provider_id.lower())

    def list_all(self) -> List[Dict[str, Any]]:
        result = []
        for p in self._providers.values():
            result.append({
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "default_model": p.default_model,
                "requires_key": p.requires_key,
                "default_base_url": p.default_base_url,
                "is_local": p.is_local,
                "badge": p.badge,
                "icon": getattr(p, "icon", "hub")
            })
        return result

    async def test_connection(
        self,
        provider_id: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Tuple[bool, str, float]:
        prov = self.get(provider_id)
        if not prov:
            return False, f"Provider '{provider_id}' not found in registry.", 0.0
        return await prov.test_connection(api_key=api_key, base_url=base_url, model=model)

    async def get_models(
        self,
        provider_id: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        prov = self.get(provider_id)
        if not prov:
            return []
        return await prov.list_models(api_key=api_key, base_url=base_url)

    @staticmethod
    def optimize_messages(
        messages: List[Dict[str, str]],
        max_context_tokens: int = 3500,
        low_token_mode: bool = True
    ) -> List[Dict[str, str]]:
        """
        Token-efficient context manager:
        1. Keeps system message intact (or compresses if overly large).
        2. Preserves latest user & assistant turn.
        3. Prunes older messages from the middle if exceeding token budget.
        """
        if not messages:
            return []

        system_contents = []
        dialog_messages = []

        for m in messages:
            if m.get("role") == "system":
                content = m.get("content", "")
                if content:
                    system_contents.append(content)
            else:
                dialog_messages.append(m)

        system_msg = {"role": "system", "content": "\n".join(system_contents)} if system_contents else None

        if not dialog_messages:
            return [system_msg] if system_msg else []

        # If low token mode is enabled, aggressively keep only recent N turns
        if low_token_mode:
            # Keep at most last 6-8 dialog messages
            dialog_messages = dialog_messages[-8:]

        # Estimate tokens
        def count_tokens(msg_list: List[Dict[str, str]]) -> int:
            return sum(LLMProvider.estimate_tokens(m.get("content", "")) for m in msg_list)

        current_tokens = (LLMProvider.estimate_tokens(system_msg.get("content", "")) if system_msg else 0) + count_tokens(dialog_messages)

        # Sliding window pruning
        while current_tokens > max_context_tokens and len(dialog_messages) > 2:
            # Drop the oldest user/assistant pair
            if len(dialog_messages) >= 2:
                dialog_messages.pop(0)
                dialog_messages.pop(0)
            else:
                dialog_messages.pop(0)
            current_tokens = (LLMProvider.estimate_tokens(system_msg.get("content", "")) if system_msg else 0) + count_tokens(dialog_messages)

        while dialog_messages and dialog_messages[0].get("role") != "user":
            dialog_messages.pop(0)

        final_list = []
        if system_msg:
            final_list.append(system_msg)
        final_list.extend(dialog_messages)
        return final_list


provider_registry = ProviderRegistry()
