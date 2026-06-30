"""Auth-mode resolution smoke test (option B — no real key required).

Two parts:
  1. Deterministic checks of the shared `resolve_auth_mode` logic. No Azure
     or network needed — proves the dual-mode wiring is correct.
  2. Optional live key->token exchange: only runs if AZURE_SPEECH_KEY is set,
     validating the Speech API-key path end-to-end. Skipped otherwise.

Run from the `backend/` directory:  python smoke_auth.py
"""

import asyncio
import os

from dotenv import load_dotenv

from services.auth import API_KEY, ENTRA, resolve_auth_mode

load_dotenv()


def test_resolution() -> None:
    # Make the auto-detect cases deterministic regardless of local env.
    os.environ.pop("AUTH_MODE", None)

    cases = [
        # (explicit, key_present, expected)
        (None, False, ENTRA),          # key-less .env -> Entra (back-compat)
        (None, True, API_KEY),         # key present -> api_key (back-compat)
        ("entra", True, ENTRA),        # force Entra even with a key
        ("api_key", False, API_KEY),   # force api_key
        ("aad", True, ENTRA),          # alias
        ("key", False, API_KEY),       # alias
        ("", True, API_KEY),           # empty override falls back to auto
    ]
    failures = 0
    for explicit, key_present, expected in cases:
        got = resolve_auth_mode(explicit, key_present)
        ok = got == expected
        failures += not ok
        print(
            f"[{'OK ' if ok else 'FAIL'}] "
            f"resolve_auth_mode({explicit!r}, key_present={key_present}) "
            f"= {got} (expected {expected})"
        )
    if failures:
        raise SystemExit(f"{failures} resolution case(s) failed.")
    print("All resolution cases passed.\n")


async def test_live_speech_key() -> None:
    key = os.getenv("AZURE_SPEECH_KEY", "").strip()
    region = os.getenv("AZURE_SPEECH_REGION", "eastus2")
    if not key:
        print(
            "AZURE_SPEECH_KEY not set — skipping live key->token exchange. "
            "Set it (and AZURE_SPEECH_REGION) to validate the Speech key path."
        )
        return

    import aiohttp

    url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    headers = {"Ocp-Apim-Subscription-Key": key, "Content-Length": "0"}
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers) as resp:
            body = await resp.text()
            if resp.status == 200:
                print(f"Live key->token OK: {len(body)}-char token from {region}.")
            else:
                print(f"Live key->token FAILED: HTTP {resp.status}: {body[:200]}")


if __name__ == "__main__":
    test_resolution()
    asyncio.run(test_live_speech_key())
