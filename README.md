# EDITH — AI Voice Assistant (POC)

EDITH is a browser-based AI voice assistant. It runs as an Angular 22 web app,
talks to a small Node/TypeScript backend, and the backend talks to OpenAI.
Primary test target: **iPhone Safari**, paired with Bluetooth
glasses/headset for audio.

> First interaction: say **"Hi Edith"** → EDITH replies **"Hi Rudra! How can
> I help you?"** — instantly, with no AI call. Everything else goes to
> OpenAI, with conversation memory and streamed responses.

---

## 1. Architecture

```
 Bluetooth glasses/headset
        │ (paired at the iOS level — this app never touches Bluetooth)
        ▼
 iPhone audio system  ───────────────────────────────────────────┐
        ▲                                                        │
        │ speaker output (SpeechSynthesis or <audio>)            │ mic input
        │                                                        ▼
 ┌───────────────────────── Angular 22 app (Safari) ─────────────────────┐
 │  VoiceService     — mic capture (MediaRecorder), permission, state    │
 │  EdithService     — local command matching + backend HTTP client      │
 │  AudioService     — speech OUTPUT (browser TTS or OpenAI TTS)         │
 │  ConversationService — transcript + bounded history for the API      │
 │  Assistant (UI)   — orb, status, transcript, mic button              │
 └───────────────────────────────┬────────────────────────────────────┘
                                  │ HTTPS (REST + SSE)
                                  ▼
 ┌───────────────────────── Node/TypeScript backend ─────────────────────┐
 │  POST /api/transcribe  → OpenAI audio transcription (speech → text)   │
 │  POST /api/chat        → OpenAI chat completion (text → text)         │
 │  POST /api/chat/stream → same, streamed via Server-Sent Events        │
 │  POST /api/tts         → OpenAI TTS (text → mp3), optional            │
 │  GET  /api/health      → liveness check                               │
 │  helmet, CORS allow-list, rate limiting, zod validation, pino logs    │
 └───────────────────────────────┬────────────────────────────────────┘
                                  │ HTTPS (OpenAI SDK, server-side only)
                                  ▼
                              OpenAI API
```

**Why speech-to-text is server-side:** iOS/macOS Safari does not implement
the Web Speech API's `SpeechRecognition` interface at all — only
`SpeechSynthesis` (speech OUTPUT) works there. So EDITH records short clips
with `MediaRecorder` + `getUserMedia` and sends them to the backend, which
transcribes them via OpenAI. This is the one architecture that reliably
works across Safari, Chrome, and Android — a `SpeechRecognition`-only
implementation would simply never capture speech on an iPhone.

**Why the OpenAI Realtime API is *not* used for V1:** it requires a
WebRTC/WebSocket streaming session and a materially more complex client.
The POC's goal is "make the basic voice loop work first" — record → transcribe
→ chat → speak is the simplest architecture that satisfies the spec. The
backend is structured so a Realtime/streaming-audio path can be added later
without touching the frontend's service boundaries (see §12 Future roadmap).

**Why Bluetooth is never touched directly:** iOS owns Bluetooth audio
routing. Once glasses/headset are paired at the OS level, any audio the page
plays (via `SpeechSynthesis` or an `<audio>` element) is automatically routed
to them by iOS. The app only ever uses standard browser mic/speaker APIs.

---

## 2. Directory structure

```
Edith/
├── backend/                  Node + TypeScript + Express
│   └── src/
│       ├── config/           env validation, logger
│       ├── controllers/      chat, tts, transcribe request handlers
│       ├── routes/           express routers
│       ├── services/         openai.service.ts, conversation.service.ts
│       ├── middleware/       error handler, zod body validation
│       ├── models/           zod schemas / types
│       └── server.ts / app.ts
│   └── tests/                vitest, OpenAI service fully mocked
│
└── frontend/                 Angular 22, standalone components, signals
    └── src/app/
        ├── core/
        │   ├── environments/ apiBaseUrl config (dev/prod)
        │   ├── models/       voice.model.ts (VoiceStatus, ConversationTurn, …)
        │   └── services/     VoiceService, AudioService, EdithService,
        │                     ConversationService, SettingsService,
        │                     OnlineStatusService
        ├── features/
        │   ├── assistant/    main screen (orb, transcript, mic button)
        │   └── settings/     TTS provider / voice / rate panel
        └── app.ts, app.config.ts
```

---

## 3. Prerequisites

- Node.js **22.22.3+** (Angular 22 CLI requires it) or Node 24.15+/26+.
  Check with `node -v`. If you're on an older Node 22.x, upgrade first
  (e.g. `winget upgrade OpenJS.NodeJS.22` on Windows, or via nvm).
- npm 10+
- An OpenAI API key with access to a chat model, an audio transcription
  model, and (optionally) a TTS model.
- iPhone with Safari, for on-device testing.
- (Optional) Bluetooth glasses/headset already paired with the iPhone.

---

## 4. Installation

```bash
# Backend
cd backend
npm install
cp .env.example .env
# edit .env and set OPENAI_API_KEY

# Frontend
cd ../frontend
npm install
```

### Environment configuration (`backend/.env`)

```env
OPENAI_API_KEY=sk-...            # required — never sent to the browser
PORT=3000
ALLOWED_ORIGIN=http://localhost:4200   # comma-separated for multiple origins
OPENAI_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
NODE_ENV=development
```

The backend validates this at startup with zod and **exits immediately**
with a clear message if `OPENAI_API_KEY` (or anything else) is missing or
malformed — it will not silently run in a broken state.

> Model names above are current as of writing. If OpenAI renames/retires a
> model, just change the `.env` value — nothing else in the code needs to
> change.

---

## 5. Running locally

### Backend

```bash
cd backend
npm run dev        # tsx watch, http://localhost:3000
# or
npm run build && npm start
```

### Frontend

```bash
cd frontend
npm start           # ng serve, http://localhost:4200
```

Open `http://localhost:4200` in **desktop Chrome** for development. Grant
microphone permission when prompted, tap the mic, and say "Hi Edith".

---

## 6. Desktop testing (Chrome)

1. Start the backend (`npm run dev` in `backend/`).
2. Start the frontend (`npm start` in `frontend/`).
3. Open `http://localhost:4200`.
4. Tap the mic button, allow microphone access.
5. Say "Hi Edith" → EDITH should reply "Hi Rudra! How can I help you?" and
   speak it aloud via your speakers.
6. Ask a real question ("What is the biggest planet?") and confirm it
   reaches OpenAI (watch the backend log) and the answer streams onto
   screen and is spoken.

`localhost` is exempt from the HTTPS requirement for `getUserMedia`, so no
certificate setup is needed for desktop dev.

---

## 7. iPhone Safari testing

Microphone access requires **HTTPS** on iOS Safari (except for `localhost`,
which an iPhone can't reach on your dev machine). The simplest path is a
tunnel:

```bash
# from frontend/, after `npm start` is already running on :4200
npx localtunnel --port 4200
# or: ngrok http 4200
```

Also point the frontend at a reachable backend URL — either tunnel the
backend too, or run both through one process/proxy. For a quick POC, tunnel
both ports and set `apiBaseUrl` in
`frontend/src/app/core/environments/environment.ts` to the backend's tunnel
URL, or set `ALLOWED_ORIGIN` on the backend to the frontend's tunnel origin
and rebuild.

### Test procedure

1. Pair Bluetooth glasses/headset with the iPhone (Settings → Bluetooth).
2. Confirm audio works using another app (e.g. Music) before testing EDITH.
3. Start backend + frontend, exposed over HTTPS (tunnel or a real deploy).
4. Open the EDITH URL in **Safari** on the iPhone.
5. Tap the mic button; Safari prompts for microphone permission — allow it.
6. Tap the mic, say **"Hi Edith."**
7. Confirm the transcript "Hi Edith" appears in the conversation area.
8. Confirm EDITH replies **"Hi Rudra! How can I help you?"** on screen.
9. Confirm the reply is **spoken aloud** — through the iPhone speaker, or
   through the Bluetooth glasses/headset if iOS has routed audio there.
10. Ask a general question ("What is the biggest planet?").
11. Confirm it reaches OpenAI (network activity / backend logs).
12. Confirm the response appears (streaming) and is spoken.
13. Ask a follow-up ("When was he born?") and confirm EDITH uses prior
    context correctly.
14. Deny microphone permission once (Settings → Safari → Microphone → Deny
    for this site, or deny the prompt) and confirm EDITH shows a clear,
    actionable error instead of hanging or crashing.
15. Test without a Bluetooth device connected — confirm audio still plays
    through the iPhone speaker normally.

### Bluetooth glasses/headset testing

EDITH does not manage Bluetooth itself. iOS decides where audio output goes
based on the active Bluetooth route. To test:

1. Pair and connect the glasses/headset in iOS Settings.
2. Play any audio (e.g. a Music app track) to confirm the Bluetooth device
   is the active output route.
3. Open EDITH and speak/listen as in the procedure above — the spoken
   response should come out of the glasses/headset.
4. If output still comes from the iPhone speaker, check iOS's audio
   route (Control Center → audio card) and reselect the Bluetooth device;
   this is an OS-level routing setting, not something the web app controls.

---

## 8. Deploying to Render

EDITH deploys as **one** Render Web Service: the backend also serves the
built Angular app as static files from the same origin
(`backend/src/app.ts`), so there's no second URL, and no CORS
configuration needed between frontend and backend in production.

### One-time setup

1. Push this repo to GitHub (or GitLab).
2. In the [Render dashboard](https://dashboard.render.com/): **New → Blueprint**,
   and connect the repo. Render reads `render.yaml` at the repo root
   automatically and creates a single `edith` web service from it.
3. When prompted for secrets, set **`OPENAI_API_KEY`** (it's marked
   `sync: false` in `render.yaml`, so Render asks for it in the dashboard
   instead of it ever being committed to git).
4. Deploy. Render runs, in order:
   - `npm install --prefix frontend && npm run build --prefix frontend`
   - `npm install --prefix backend && npm run build --prefix backend`
   - starts with `npm start --prefix backend`

That's it — no other configuration is required. `render.yaml` sets sane
defaults for `OPENAI_MODEL` / `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` /
`OPENAI_TRANSCRIBE_MODEL` (edit `render.yaml` or override them per-service
in the dashboard if you want different models), and `NODE_ENV=production`.
`PORT` is supplied by Render automatically and doesn't need to be set.

### Without a Blueprint (manual Web Service)

If you'd rather click through the UI instead of using `render.yaml`:

- **Root Directory:** repo root (leave blank)
- **Build Command:**
  `npm install --prefix frontend && npm run build --prefix frontend && npm install --prefix backend && npm run build --prefix backend`
- **Start Command:** `npm start --prefix backend`
- **Health Check Path:** `/api/health`
- **Environment variables:** set `OPENAI_API_KEY` (required) and,
  optionally, `OPENAI_MODEL` / `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` /
  `OPENAI_TRANSCRIBE_MODEL` / `NODE_ENV=production`.

### After deploying

- Open the assigned `https://<your-service>.onrender.com` URL in Safari —
  it's already HTTPS, so microphone access works immediately (see §7 for
  the iPhone test procedure; no tunnel needed once deployed).
- The backend automatically trusts requests from its own Render URL (via
  Render's auto-injected `RENDER_EXTERNAL_URL`), so `ALLOWED_ORIGIN` does
  not need to be set manually for this same-origin setup. Only set
  `ALLOWED_ORIGIN` if you host the frontend somewhere else and point it at
  this backend as a separate origin.
- Render's free plan spins the service down after inactivity; the first
  request after idling will be slow (cold start) while it spins back up.

### Alternative: zero-server deployment (Static Site + your own API key)

If you'd rather not run a backend at all — e.g. Render's free Web Service
tier requires card verification on your account and you want to avoid
that — EDITH can also run as a **plain static site with no server**:

1. Deploy `frontend/` alone as a Render **Static Site**:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist/frontend/browser`
2. Open the deployed site, tap **⚙ Settings**, and paste your own OpenAI
   API key into **"Your OpenAI API key"**.

With a key set there, `EdithService`/`AudioService` route every OpenAI call
(`OpenAiDirectService`) straight from the browser to `api.openai.com` —
no backend involved. Leave the field blank and the app falls back to the
backend as normal, so nothing about the default (recommended) setup
changes.

**Read before using this mode:** the key is stored only in that browser's
`localStorage` and is visible to anyone with access to that browser/device
(dev tools, network tab). This is fundamentally different from — and does
**not** reintroduce — the risk of shipping a key inside the app's own code:
it's a key *you* typed into *your own* browser, for *your own* use, never
bundled into anything served to other visitors. Only use it on a personal
device you trust, with a key you're comfortable being visible there, and
never share that browser's storage or a screen recording that shows it.
Prefer the backend-backed deployment above whenever you can — it's the
only mode where the key never touches a browser at all.

---

## 9. PWA / Add to Home Screen

EDITH ships a `manifest.webmanifest` and an Angular service worker
(`@angular/service-worker`, generated from `ngsw-config.json`) for an
offline app shell.

To install on iPhone:

1. Open the EDITH URL in Safari (must be HTTPS).
2. Tap the Share icon → **Add to Home Screen**.
3. Launch EDITH from the Home Screen icon — it opens full-screen, without
   Safari's UI chrome.

**Important:** installing the PWA does **not** remove iOS's microphone or
background-execution limitations. It's still tap-to-talk, and the mic still
requires a page in the foreground and an explicit user gesture per
recording. The PWA gives you an app-like icon/launch experience and basic
offline shell — nothing more.

---

## 10. iOS / Safari limitations (read this before filing a "bug")

- **No `SpeechRecognition` in Safari.** EDITH works around this by
  recording audio and transcribing it server-side (§1). This means each
  utterance has a short round-trip delay (record → upload → transcribe)
  instead of live on-device transcription.
- **No continuous background microphone access.** Safari requires a direct
  user gesture (tap) to open a mic stream, and will not keep it open if the
  tab is backgrounded or the screen locks. **V1 is tap-to-talk by design** —
  this is not a bug to be fixed later, it's a platform constraint.
- **No real wake-word ("Hi Edith") detection while idle.** A true wake-word
  engine needs a persistently-open microphone, which iOS Safari does not
  allow. What EDITH *does* implement: once you've tapped to talk, saying
  "Hi Edith" as your utterance is recognized locally and answered instantly
  without an AI call (`EdithService.handleLocalCommand`). This is
  documented explicitly so it isn't mistaken for background wake-word
  support, which this POC does **not** fake.
- **HTTPS is required** for `getUserMedia` on real devices (localhost is
  exempt). Use a tunnel or real TLS deployment for iPhone testing.
- **Audio routing to Bluetooth is entirely iOS's decision.** The app cannot
  force output to a specific device; it can only play through the standard
  audio element/SpeechSynthesis and let iOS route it.
- **Browser `SpeechSynthesis` frequently fails to route to a connected
  Bluetooth device on iOS/iPadOS Safari at all** — confirmed on real
  Bluetooth glasses hardware: EDITH's spoken reply was silent over
  Bluetooth using the browser voice, while switching Settings → Voice
  output to "OpenAI speech" (which plays through a real `<audio>` element
  instead of `SpeechSynthesis`) worked correctly and routed to the
  Bluetooth device every time. This is why **EDITH defaults to OpenAI
  speech**, not the browser voice, despite the browser voice being free
  and offline-capable — reliability on Bluetooth mattered more for this
  app's core use case. If you switch to "Browser speech" and it goes
  silent with a Bluetooth device connected, that's this bug, not a new
  issue — switch back to "OpenAI speech."

---

## 11. Security notes

- `OPENAI_API_KEY` lives only in `backend/.env` and is never sent to, or
  logged by, the frontend. The Angular app only ever calls the EDITH
  backend's own `/api/*` routes.
  - **Exception, opt-in only:** if a user pastes their own key into
    Settings ("Your OpenAI API key"), the app calls OpenAI directly from
    that browser instead (`OpenAiDirectService`) so it can run with no
    backend at all. That key is stored only in that browser's
    `localStorage` and is never part of the app's shipped code — it's not
    the same risk as embedding a key in the bundle, but it is visible to
    anyone with access to that browser/device. See §8 "Alternative:
    zero-server deployment" for the full tradeoff. This field is blank by
    default and the app works exactly as described above until a user
    fills it in themselves.
- `.env` is git-ignored in both `backend/` and the repo root; `.env.example`
  documents required variables without values.
- The backend validates all input with zod (`middleware/validate.ts`),
  rejects oversized payloads (`express.json({ limit: '100kb' })`, 10MB cap
  on audio uploads), applies `helmet()` security headers, restricts CORS to
  an explicit origin allow-list, and rate-limits the AI-backed endpoints
  (30 req/min/IP) to control cost and abuse.
- Errors are centralized (`middleware/errorHandler.ts`) and never leak stack
  traces, upstream error bodies, or secrets to the client.
- Logging (`pino`) redacts authorization headers and any field literally
  named `apiKey`/`OPENAI_API_KEY`.

---

## 12. Troubleshooting

**Microphone permission denied**
- iPhone: Settings → Safari → Microphone → set to "Ask" or "Allow", then
  reload the EDITH tab. Per-site overrides can also be cleared in Settings →
  Safari → Advanced → Website Data.
- Desktop Chrome: click the lock/site-info icon in the address bar →
  Site settings → Microphone → Allow, then reload.
- EDITH shows a specific on-screen banner when permission is denied instead
  of silently failing.

**No audio is captured / "No speech was detected"**
- Confirm the correct input device is selected at the OS level (especially
  relevant if a Bluetooth headset's mic is also active — try disabling its
  mic and using the iPhone's mic if transcripts come back empty).
- Speak for at least ~1 second — very short clips can transcribe as empty.

**Audio routing (response not heard on Bluetooth device)**
- See §7 "Bluetooth glasses/headset testing" — this is an iOS Control
  Center audio-route setting, not an EDITH setting.
- If nothing is heard at all (not even on the iPhone speaker), check the
  iPhone's silent switch/mute switch and volume.

**"OpenAI request failed" / 502 errors**
- Check `backend` logs — the real OpenAI error status/code is logged there
  (never shown to the browser). Common causes: invalid/expired API key,
  model name not enabled on your account, or you're over your OpenAI usage
  quota.

**CORS errors in the browser console**
- Add the exact origin you're testing from (including port, and the tunnel
  URL if applicable) to `ALLOWED_ORIGIN` in `backend/.env`, comma-separated
  for multiple origins, and restart the backend.

---

## 13. Future roadmap (not implemented in this POC, by design)

Per the project brief, V1 intentionally stops at "the basic voice loop
works." The codebase is structured so these can be layered in later without
a rewrite:

- Real wake-word engine (would need a native companion or a persistent
  audio pipeline outside Safari's constraints)
- OpenAI Realtime API (speech-to-speech, interruption/barge-in, lower
  latency) as an alternative backend path behind the same `EdithService`
  interface
- WebRTC for lower-latency audio streaming
- LangChain / LangGraph agent orchestration
- Long-term memory, RAG, vector database
- MCP tool integrations (Gmail, calendar, weather, reminders, web search)
- Camera/vision, smart-home tools
- Multi-user profiles + authentication
- Multiple selectable voices
- Native iOS/Android companion apps (would remove the Safari mic/background
  constraints entirely)

---

## 14. What currently works

- Full voice loop: tap mic → record → transcribe (OpenAI) → local command
  match or AI chat (streamed) → spoken response, on desktop Chrome and
  iPhone Safari (over HTTPS).
- Deterministic "Hi Edith" / "Hey Edith" / "Hello Edith" greeting with zero
  AI-token cost, extensible for more local commands.
- Multi-turn conversation with pronoun/context resolution, bounded history
  sent to the model.
- Streaming responses via SSE, rendered token-by-token in the UI.
- Switchable TTS: OpenAI-generated speech (default — reliably routes to
  Bluetooth, see §10) or the browser's on-device `SpeechSynthesis`
  (offline-capable, but see the Bluetooth caveat), from Settings.
- Explicit mic-permission handling, denied/unsupported states, and
  guaranteed track cleanup after every recording.
- PWA manifest + service worker + Add to Home Screen on iPhone.
- Backend: input validation, centralized error handling, structured
  logging, CORS allow-list, rate limiting, startup env validation.
- Automated tests: backend (OpenAI service fully mocked, 8 tests) and
  frontend (greeting detection, conversation history, voice state machine,
  14 tests) — no real OpenAI calls in CI.

## 15. Known limitations

- Tap-to-talk only; no background/idle wake-word listening (see §9).
- Each utterance has a short record→upload→transcribe round trip rather
  than live transcription (a Safari platform constraint, not a bug).
- Bluetooth routing is fully delegated to iOS and cannot be forced by the
  app.
- Conversation history is in-memory per browser session only (no persisted
  long-term memory yet).
- No authentication — this is a single-user local POC.

## 16. Next recommended milestone

With the base loop verified end-to-end on iPhone Safari + Bluetooth, the
next highest-value step is evaluating the **OpenAI Realtime API** as an
alternative to record→transcribe→chat→speak, to cut round-trip latency and
add true interruption/barge-in — while keeping the current architecture as
the offline-capable/simple fallback path.
