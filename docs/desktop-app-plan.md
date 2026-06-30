# Desktop App Plan (Tauri) — Standalone Distribution

> Goal: Package the standalone (non-Teams) version as an installable desktop app (Tauri).
> Teams integration stays as-is. Track progress here so work can continue on any machine.

## Architecture

```
realtime-qa.exe (double-click to run)
└── Tauri shell
    ├── frontend (React, unchanged)  ── WebSocket ──┐
    └── backend.exe (PyInstaller of FastAPI)  <──────┘
```

- Desktop: webview wraps frontend locally; backend runs as sidecar. No network needed except Azure APIs.
- Teams: frontend served via tunnel/cloud URL. Same codebase, different entry.

---

## Key decision: dual authentication model

Target users are unknown — some bring their own **Entra ID / Azure account**, others
bring their own **API key**. The app must support **both** auth modes and let the user
pick per service in Settings. This drives the phasing below.

Current code status:

| Service | API key | Entra ID | Gap |
|---------|---------|----------|-----|
| Foundry (`summarizer.py`) | ✅ | ✅ | none — already dual-mode |
| Speech (`/api/speech-token`) | ✅ | ✅ | none — API-key path added in v3.8.0 (regional `issueToken`) |

Design principle to minimize rework: establish an explicit `auth_mode`
(`api_key` \| `entra`) abstraction first, shared by Foundry and Speech, so each
auth path can be added independently without reworking the other.

---

## TODO

### Phase 0: Auth foundation (do first — shared by both paths)
- [x] 0.1 Introduce explicit `auth_mode` (`api_key` | `entra`); unify Foundry + Speech auth resolution (replace implicit "is key set?" logic) — `services/auth.py`
- [x] 0.2 Add **API-key path** to `/api/speech-token` (key + region → regional `issueToken` REST → short-lived token; keep Entra path as fallback)
- [ ] 0.3 Verify on a clean machine (no Azure CLI) that **both** key and Entra modes run summary/QA/speech end-to-end

### Phase 1: Config contract (depended on by everything above — lock early)
- [ ] 1.1 Define config schema covering both: `auth_mode` + key fields / entra tenant fields, for Foundry and Speech
- [ ] 1.2 Backend reads from **config file** (replace `.env`; keep `.env` as dev fallback)
- [ ] 1.3 Drop `--reload` in production; make port configurable (prep for sidecar)
- [ ] 1.4 Ensure dev `.env` (with personal subscription IDs) NOT bundled

### Phase 2: Auth hardening (two independent branches)
- [ ] 2.1 key users: store API keys in **OS keychain / Windows Credential Manager** (NOT plain config.json)
- [ ] 2.2 entra users: **persistent token cache** to avoid browser re-login on every launch
- [ ] 2.3 (optional) Windows `azure-identity-broker` (WAM/SSO) for silent refresh

### Phase 3: Bundle backend (PyInstaller proof)
- [ ] 3.1 PyInstaller spec collecting `certifi` / `openai` / `mcp` / `azure.identity`
- [ ] 3.2 Build `backend.exe` (prefer onedir over onefile); verify TLS to Azure + Learn MCP works
- [ ] 3.3 Verify both auth modes work inside the packaged exe

### Phase 4: Tauri shell + sidecar
- [ ] 4.1 Tauri scaffold (`tauri init`; window title/size/icon)
- [ ] 4.2 Sidecar: auto start/stop backend; kill on exit
- [ ] 4.3 Port conflict detection (8000 busy) + dynamic port
- [ ] 4.4 CORS: allow Tauri webview origin (`tauri://localhost`)
- [ ] 4.5 CSP `connect-src` allowlist: `ws://localhost:*`, `*.openai.azure.com`, Speech domains, `learn.microsoft.com`
- [ ] 4.6 WebSocket auto-reconnect when backend restarts

### Phase 5: Settings UI (after config contract is stable)
- [ ] 5.1 First-run wizard + Settings menu entry
- [ ] 5.2 **Auth-mode radio** (API key / Entra login); show fields per choice
- [ ] 5.3 "Test connection" before save (validate Foundry + Speech)
- [ ] 5.4 Config import/export (shareable team template, NO secrets)

### Phase 6: Desktop UX
- [ ] 6.1 Splash screen (backend startup 3-5s)
- [ ] 6.2 Single-instance (focus existing, no double-open)
- [ ] 6.3 System tray (minimize to background)
- [ ] 6.4 Mic permission prompt + guidance (WebView2 / macOS `NSMicrophoneUsageDescription`)
- [ ] 6.5 Export: native "Save As" dialog
- [ ] 6.6 Friendly network/API error states + offline detection
- [ ] 6.7 Firewall popup guidance (port 8000 local)

### Phase 7: Compliance & release
- [ ] 7.1 Privacy note (where audio/transcript is processed, data residency) + third-party license notices
- [ ] 7.2 App icon
- [ ] 7.3 `tauri build` → .msi installer
- [ ] 7.4 WebView2 runtime bundled/auto-install (Win10)
- [ ] 7.5 Code signing (avoid AV false positives) + per-user install (no admin)
- [ ] 7.6 Logs to `%APPDATA%/realtime-qa/logs/`
- [ ] 7.7 Auto-update (Tauri updater → GitHub Release) + config migration across versions
- [ ] 7.8 Clean uninstall + GitHub Actions CI (multi-OS build on push)

---

## Distribution notes
- Each user provides own credentials for **Foundry** (endpoint + deployment + key OR Entra) and **Speech** (region + key OR Entra)
- Users must each have their own Azure resources; first-run wizard must state this clearly
- Installer ships no secrets
- CSP allowlist needed for Azure endpoints
- **Min viable = Phases 0-3** (dual-auth + config + standalone exe). Phase 0.1/0.2 done in v3.8.0; next is the config contract (Phase 1).
```

