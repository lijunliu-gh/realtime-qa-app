# Teams Side Panel Integration

将 RealtimeQA 作为 Teams 会议侧边栏运行，利用 Teams 的实时字幕（包含说话人姓名）+ 现有 QA pipeline。

## Architecture

```
Teams Meeting (live captions) → Side Panel (React) → WebSocket → FastAPI → MCP + GPT → Answer
```

- **输入**: Teams live captions（自带说话人真实姓名）
- **输出**: 只有打开 Side Panel 的你能看到 QA 答案
- **后端**: 完全复用现有 FastAPI + MCP + Summarizer

## Prerequisites

1. **Microsoft 365 Developer Tenant** (or your org tenant with sideloading enabled)
2. **Entra App Registration** with these API permissions:
   - `OnlineMeeting.ReadBasic.Chat` (Delegated)
   - `OnlineMeetingTranscript.Read.Chat` (Delegated)
3. **Teams Admin** must enable meeting captions/transcription in Teams Admin Center:
   - Meetings → Meeting policies → Allow transcription: ON
   - Meetings → Meeting policies → Allow captions: ON

## Setup Steps

### 1. Register Entra App

```bash
# Create app registration
az ad app create --display-name "RealtimeQA-Teams" \
  --web-redirect-uris "https://YOUR_DOMAIN/teams/sidepanel" \
  --enable-id-token-issuance true

# Note the appId — you'll need it for manifest.json
```

### 2. Configure manifest.json

Edit `teams/appPackage/manifest.json`:
- Replace `{{APP_ID}}` with your Entra App ID
- Replace `{{BASE_URL}}` with your deployed frontend URL (e.g., `https://your-app.azurestaticapps.net`)
- Replace `{{DOMAIN}}` with your domain (e.g., `your-app.azurestaticapps.net`)

### 3. Add icons

Replace the placeholder files:
- `teams/appPackage/color.png` — 192x192 full-color icon
- `teams/appPackage/outline.png` — 32x32 white outline on transparent background

### 4. Package and sideload

```bash
cd teams/appPackage
# Zip the manifest + icons
zip -r ../realtimeqa-teams.zip manifest.json color.png outline.png
```

Then in Teams:
1. Go to Apps → Manage your apps → Upload a custom app
2. Upload `realtimeqa-teams.zip`
3. In a meeting, click "+" → find "RealtimeQA" → add to meeting

### 5. Deploy frontend + backend

Both need to be accessible from Teams (HTTPS required):

**Option A: Azure Static Web Apps + Azure Container Apps**
```bash
# Frontend (SWA handles SPA routing automatically)
cd frontend && npm run build
swa deploy dist/ --env production

# Backend (existing FastAPI)
# Deploy to Container Apps / App Service with HTTPS
```

**Option B: Dev tunnel for local testing**
```bash
# Start backend
cd backend && uvicorn main:app --port 8000

# Start frontend
cd frontend && npm run dev

# Expose via dev tunnel (Teams requires HTTPS)
devtunnel host --port-numbers 5173 --allow-anonymous
```

Update `manifest.json` BASE_URL and DOMAIN with your tunnel URL.

## How It Works

1. User opens the Side Panel during a Teams meeting
2. `useTeamsTranscript` hook calls `meeting.registerMeetingCaptionsHandler()`
3. Teams pushes each caption line (with speaker display name) to the handler
4. Handler sends `{ type: "transcript", speaker, text }` over WebSocket
5. Backend runs the same debounce → summarize → extract questions → MCP search → GPT answer pipeline
6. Answers stream back to the Side Panel via WebSocket

## Key Differences from Standalone Mode

| Aspect | Standalone | Teams Side Panel |
|--------|-----------|-----------------|
| Speech input | Azure Speech SDK (microphone) | Teams live captions |
| Speaker ID | Anonymous (Guest1, Guest2) | Real display names |
| Auth | Speech token | Entra ID (meeting context) |
| Visibility | Anyone with URL | Only you (in your panel) |
| Deployment | localhost / any URL | HTTPS + Teams app package |

## Limitations & Notes

- **Captions must be enabled** in the meeting (either by admin policy or by a user clicking "Turn on live captions")
- The Teams JS SDK caption API is available in Teams desktop/web client (not mobile yet)
- Backend must be HTTPS-accessible from the Teams client
- Meeting recordings/transcripts are separate from live captions — this uses live captions for real-time
