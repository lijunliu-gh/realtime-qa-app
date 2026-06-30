"""Shared authentication-mode resolution for Foundry and Speech services.

Distributed desktop users are unknown — some bring their own Entra ID
account, others bring their own resource key. Each service therefore
supports two modes, selectable independently:

  - "api_key": authenticate with a resource key
  - "entra":   authenticate via Entra ID
               (DefaultAzureCredential -> InteractiveBrowserCredential)

Resolution order (per service):
  1. An explicit per-service override (e.g. AZURE_OPENAI_AUTH_MODE /
     AZURE_SPEECH_AUTH_MODE)
  2. The global AUTH_MODE env var
  3. Auto-detect: api_key when a key is configured, else entra

Auto-detect preserves existing key-less `.env` setups (which authenticate
via Entra) without requiring any new variables — so current installs keep
working unchanged.
"""

from __future__ import annotations

import os

API_KEY = "api_key"
ENTRA = "entra"

_API_KEY_ALIASES = {"api_key", "apikey", "key"}
_ENTRA_ALIASES = {"entra", "entra_id", "entraid", "aad", "azuread"}


def resolve_auth_mode(explicit: str | None, key_present: bool) -> str:
    """Return ``"api_key"`` or ``"entra"`` for a single service.

    ``explicit`` is a per-service override (may be ``None`` or empty). When
    unset, the global ``AUTH_MODE`` env var is consulted; when that is also
    unset, the mode is auto-detected from ``key_present``.
    """
    raw = (explicit or os.getenv("AUTH_MODE") or "").strip().lower()
    if raw in _API_KEY_ALIASES:
        return API_KEY
    if raw in _ENTRA_ALIASES:
        return ENTRA
    return API_KEY if key_present else ENTRA
