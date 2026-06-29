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

## TODO

### Phase 1: Scaffold
- [ ] 1. Install Rust + Tauri CLI (`rustup`, `npm i -g @tauri-apps/cli`)
- [ ] 2. `npx tauri init` (creates `src-tauri/`)
- [ ] 3. Configure window (title, size, icon)
- [ ] 4. `npx tauri dev` — verify UI loads

### Phase 2: Settings & Config
- [ ] 5. Frontend: Settings page (first-run wizard + menu entry)
- [ ] 6. Frontend: validate config (test connection before save)
- [ ] 7. Backend: read from config file, not only `.env`
- [ ] 8. CORS: allow Tauri webview origin
- [ ] 9. Secrets: store API keys in Windows Credential Manager / Tauri stronghold (NOT plain config.json)
- [ ] 10. Config import/export (shareable template for teams)

### Phase 3: Bundle Backend
- [ ] 11. PyInstaller package backend → backend.exe (prefer onedir over onefile for speed)
- [ ] 12. Tauri sidecar: auto start/stop backend; kill on exit
- [ ] 13. Port conflict detection (8000 busy) + dynamic port
- [ ] 14. WebSocket auto-reconnect when backend restarts
- [ ] 15. Ensure dev `.env` (with personal subscription IDs) NOT bundled

### Phase 4: UX
- [ ] 16. Splash screen (backend startup 3-5s)
- [ ] 17. Single-instance (focus existing, no double-open)
- [ ] 18. System tray (minimize to background)
- [ ] 19. Export: native "Save As" dialog
- [ ] 20. Friendly network/API error states (no white screen)
- [ ] 21. Offline detection + message
- [ ] 22. Mic permission prompt + guidance
- [ ] 23. Firewall popup guidance (port 8000 local)

### Phase 5: Compliance & Release
- [ ] 24. LICENSE + third-party license notices
- [ ] 25. Privacy note: where audio/transcript is processed, data residency
- [ ] 26. App icon
- [ ] 27. `npx tauri build` → .msi installer
- [ ] 28. WebView2 runtime bundled/auto-install (Win10)
- [ ] 29. Code signing (avoid AV false positives)
- [ ] 30. Per-user install option (no admin)
- [ ] 31. Logs to %APPDATA%/realtime-qa/logs/
- [ ] 32. Auto-update (Tauri updater → GitHub Release)
- [ ] 33. Config migration across versions
- [ ] 34. Clean uninstall
- [ ] 35. GitHub Actions CI (multi-OS build on push)

---

## Distribution notes
- Each user provides own: AZURE_OPENAI_ENDPOINT, API_KEY, DEPLOYMENT, SPEECH_REGION, SPEECH_RESOURCE_ID
- Installer ships no secrets
- CSP allowlist needed for Azure endpoints
- Min viable = Phases 1-3
```

