# Haven — AI wellbeing companion (MVP demo)

An interactive demo of a calm, private conversation companion called **Ari**: text chat, voice conversation, a hardcoded psychology knowledge library, daily mood check-ins and local conversation history.

> Ari is an AI companion, **not a licensed psychologist** and **not a diagnostic tool**. The demo uses fictional sample data only.

- **Guest mode.** No sign-up, no accounts, and no payments, subscriptions or billing. Legacy routes like `/pricing`, `/billing` and `/login` redirect to the dashboard.
- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide icons. No database: everything is stored in the browser's `localStorage`.
- **AI:** Groq's OpenAI-compatible API, called **server-side only**, with an automatic scripted fallback.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — add GROQ_API_KEY for real AI replies
npm run dev
```

Open http://localhost:3000. Without a key the app runs fully offline in **demo mode** (a scripted conversation engine), so every screen works out of the box.

Other scripts: `npm run build && npm start` (production), `npm run lint`, `npm run typecheck`, `npm test` (all tests: `test:agent` conversation flow, `test:strategy` counselling move selection, `test:safety` crisis screening and privacy, `test:voice` mic and speech lifecycle with fake browser APIs), `npm run eval:scenarios` (10 multi-turn scenarios against live Groq), `npm run eval:prompt` (live A/B test of the Groq prompt — uses your API quota).

## Configuration (`.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `groq` if a key is set, else `demo` | `groq` or `demo` |
| `GROQ_API_KEY` | — | Server-only key from console.groq.com. Never exposed to the browser. |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Chat model (a Groq production model as of Nov 2026) |
| `GROQ_VOICE_MODEL` | `GROQ_MODEL` | Optional faster model for voice, e.g. `openai/gpt-oss-20b` |
| `GROQ_FALLBACK_MODEL` | the other gpt-oss model | Retried once if the main model is rate-limited; `none` disables |
| `GROQ_STT_MODEL` | `whisper-large-v3-turbo` | Speech-to-text fallback for browsers without built-in recognition |
| `GROQ_TTS_MODEL` | *(unset)* | Optional server voice, e.g. `canopylabs/orpheus-v1-english` (Groq preview model) |
| `GROQ_TTS_VOICE` | `hannah` | Orpheus voice: autumn, diana, hannah, austin, daniel, troy |
| `GROQ_TIMEOUT_MS` | `20000` | Abort and fall back to demo mode after this long |

Groq deprecated `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` for free and developer plans on 2026-08-16, so the default is `openai/gpt-oss-120b`, with reasoning output disabled. **Settings → Test connection** verifies the key and model.

## What's inside

| Screen | Highlights |
| --- | --- |
| **Dashboard** `/` | Start AI or voice conversation, the library, mood check-in, history, settings, practice of the day, weekly mood, recent chats |
| **Chat** `/chat` | Streaming replies, stage indicator, context-aware quick replies (including "I'd rather not say"), dictation, stop button, inline crisis card, library source chips |
| **Voice** `/voice` | Mic → speech-to-text → AI → speech, with sentence-by-sentence streaming speech. Listening, thinking and speaking animations, live transcript, mute, voice on/off, interrupt (Space), end session and summary, typed fallback |
| **Library** `/library` | 29 evidence-informed entries with search, filters, step-by-step techniques, an animated breathing guide, sources, and "Practise with Ari" |
| **Mood** `/mood` | Mood, energy, sleep, tags and a private note. 14-day chart, averages, and "Reflect with Ari" |
| **History** `/history` | Search, filter, continue, delete, clear all |
| **Settings** `/settings` | AI mode and status, consent switches, voice engine, device voice and pace, theme, sample data, JSON export, clear and reset |
| **Get help** `/support` | Verified crisis lines (US, Canada, UK and Ireland, Australia, New Zealand, India, worldwide), emergency numbers, abuse helplines |

## Voice-first behaviour

- **Ari checks in when you're quiet.** After about 8 seconds of silence (adjustable, or off, in Settings), Ari asks an easy question from the conversation flow, never the one it just asked. A second silence gets a gentle "I'm here whenever you're ready". Then Ari waits quietly until you speak. Check-ins run on the device, so they cost no API quota. After a safety concern, the check-in is about safety and includes crisis lines.
- **Ari explains.** Ask "what is…", "why…" or "explain…" and Ari gives a clear spoken explanation from the knowledge library, about 90 words, then offers a related exercise.

## Counselling communication

Ari's replies are planned turn by turn by a strategy engine (`src/lib/agent/strategy.ts`) built on evidence-informed counselling communication: reflective listening, Motivational Interviewing (OARS), person-centred empathy, trauma-informed choice, and safe messaging. In practice:
- Ari reflects the feeling under your words and explores before suggesting anything.
- It summarises, then asks permission before offering ideas.
- It comforts in grief, lowers the pressure on short answers, and follows your lead.
- It gives direct help when you ask for it.

See [docs/conversation-engine.md](docs/conversation-engine.md) for the design and [docs/communication-research.md](docs/communication-research.md) for the research and sources.

## Conversation design

`src/lib/agent/` holds the conversation logic.

- **`state.ts`** re-derives the conversation state from the message history: stage, remembered facts, answered and skipped topics. It runs identically on the client and the server.
- **`extract.ts`** is the rule-based understanding layer: name, household, work or study, interests, sentiment, skip signals, topic requests, diagnosis questions, and "are you a bot?".
- **`questions.ts`** is the question bank for the five stages (introduction → your world → daily life → wellbeing → support). At most one question is asked per reply. Questions are never repeated, skipped topics are never revisited, and declining a family question drops all household and relationship topics.
- **`examples.ts`** holds 13 short, fictional example exchanges (few-shot examples). They show Ari's tone and boundaries: reflect first, one question, accept skips, no diagnosis, honest AI disclosure, gentle safety checks, and spoken style in voice mode. Only the 1–3 that fit the current moment go into each prompt (voice gets only safety and boundary examples), adding about 250–300 tokens. Safety situations always win the selection.
- **`turn.ts`** prepares each turn: redaction, analysis, risk screening, retrieval and the prompt. `/api/chat` and `scripts/prompt-eval.ts` share it, so the evaluation tests exactly what users get.
- **`prompt.ts`** is the Groq system prompt. It covers persona, style, boundaries (no diagnosis, AI disclosure, banned openers) and the current stage. It also includes a hint for the next topic, topics already covered or declined, consented memory, and retrieved knowledge.
- **`demo-engine.ts`** is the scripted fallback. It builds each reply as a reflection, optional knowledge or technique, and one question. There is no user-selectable offline mode: it only answers when the server has no Groq key, or when Groq fails or hits a rate limit mid-conversation.
- **`knowledge/`** holds the knowledge base and keyword retrieval, which feeds reference notes to the model and source chips to the UI.

Adapting to the user:
- If they raise a topic, ask for tips, or express strong feelings, Ari goes straight to support.
- If they mention a rough day, Ari asks whether they want to talk about it or take their mind off it.

## Safety and privacy

- **Crisis screening.** Every message is screened for crisis risk before it leaves the device and again on the server (`src/lib/safety/crisis.ts`). High-risk messages are **never sent to the AI**: they get a deterministic response with crisis lines, and the next turns keep safety first. Distress triggers a direct, gentle safety check.
- **Consent.** Consent is explicit and separate for:
  - sending messages to Groq (onboarding),
  - sharing remembered personal context (off by default),
  - voice input (asked before the first mic use, explaining where audio and transcripts go).
- **Data minimisation.** Only the last 16 messages are sent. Emails, phone numbers, addresses, card or ID numbers and credentials are redacted on the client and again on the server. Memory is sent only with consent. Conversations with crisis content get a neutral title in History.
- **Local storage.** Everything is kept in `localStorage`, can be exported, and can be cleared in one click. Audio is never stored.
- **Other safeguards.** The API key stays on the server. Requests are validated and size-limited, there is an in-memory rate limiter, and security headers are set, with the microphone allowed for the same origin only.

## Voice support

**Speech-to-text.** Each turn is recorded and transcribed by **Groq Whisper** in every browser. It handles accents and phone microphones much better than built-in recognisers, iOS especially. Your words appear after you pause. In Settings you can switch to **live browser captions** instead: Chrome and Edge use the browser maker's online service, and Safari uses Apple's. Without a Groq key on the server, the browser recogniser is used, or typing where none exists.

The recorder learns the room's noise level in the first half-second, so quiet phone mics still register speech. It resumes the audio context that iOS starts paused, and drops phantom phrases Whisper produces in silence ("Thanks for watching!"). "Send now" always uploads what was recorded.

**Text-to-speech.** Device voices. With `GROQ_TTS_MODEL` set, you can choose Groq Orpheus in Settings. It falls back to device voices on any error.

## How Ari presents itself

Ari introduces itself as a **virtual care assistant working alongside your psychologist** (`APP.role` and `APP.careTeam` in `src/lib/config.ts`; change them to suit the practice). It doesn't call itself "an AI" unprompted, but it never claims to be a person, psychologist or clinician. If someone asks directly whether they're talking to a person or a bot, it answers honestly. This is a safety and consumer-protection requirement for a mental-health product.

## Groq is always on

There is no offline mode to choose. Whenever the server has a `GROQ_API_KEY`, every browser uses Groq for replies and Whisper for speech, including browsers that chose offline mode in an earlier version. The welcome screen has a single **Agree and start** button that explains what is sent to Groq. Personal-context sharing and voice remain separate opt-ins. Messages that suggest someone may be in danger are still never sent.

## Mobile

The layout is phone-first with a bottom tab bar and safe-area padding. The app can be installed: in Safari, tap Share → Add to Home Screen; in Chrome, use Install app. It then opens full-screen with its own icon (`src/app/manifest.ts`, `apple-icon.tsx`).

## Prompt evaluation

`npm run eval:prompt` replays 18 fictional conversations against live Groq, with and without the examples, runs automatic checks, and writes a blind X/Y file for review. Use `--only c11,c13` and `--samples 3` to re-test specific cases.

In a blind three-judge test (spec and safety, counselling quality, naturalness), the examples scored 6.93 against 6.78 without, with the biggest gains on spec compliance and counselling quality. A first draft of the examples made voice replies longer, so voice now gets only the safety and boundary examples.

## Groq free tier

On the free tier, Groq allows about 8,000 tokens per minute and 1,000 requests per day for each model. A chat request uses roughly 1,500–2,500 tokens, so very fast back-and-forth can hit the per-minute cap. When it does, the server retries once on the other gpt-oss model, which has its own quota. If that model is also limited, the scripted engine answers, and the UI labels that reply.

## Known limitations (demo)

- Risk screening is rule-based. It is a safeguard, not a clinical assessment.
- The scripted engine is intentionally simple; natural flexibility comes from Groq mode.
- The Groq happy path was built from Groq's API docs. Only the failure and fallback path was exercised locally, because no key was configured.
- Orpheus TTS is a Groq *preview* model, limited to 200 characters per request (the app chunks by sentence).
