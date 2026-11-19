# Ari's conversation engine

This document describes how Ari decides what to say, the counselling communication principles it applies, and what was changed to get there. The research behind it, with sources, is in [communication-research.md](communication-research.md).

Ari applies communication *principles* used by trained counsellors: reflective listening, Motivational Interviewing's OARS, person-centred empathy, trauma-informed choice, and safe messaging. It does **not** take on their identity or clinical authority. It is an AI wellbeing companion, not a substitute for licensed care.

## Architecture

Conversational rules, state and retrieval are model-agnostic. Only `src/lib/server/groq.ts` knows about Groq.

| Component | File | Role |
|---|---|---|
| Conversation state manager | `src/lib/agent/state.ts`, `extract.ts` | Re-derives stage, remembered facts, answered and declined topics, and per-message facts (sentiment with clause-scoped negation, concerns, hard news, requests) from the history on every turn. |
| Strategy engine | `src/lib/agent/strategy.ts` | Picks one conversational move per turn (see below) and writes a directive for it. |
| Question selection | `strategy.ts` (question kinds), `questions.ts` | One question at most. Avoids question kinds already asked (e.g. "how long", "hardest part"). The stage-plan question is only suggested in light conversation. |
| Reflection | strategy directives and examples | Reflect the feeling under the words, tentatively; collecting summaries after about four exploring turns; hold space (no question) after two question turns in a hard stretch. |
| Few-shot examples | `src/lib/agent/examples.ts` | 19 fictional exchanges. The one matching the planned move goes into the prompt, plus safety and boundary examples. Voice gets one at most. |
| Knowledge retrieval | `src/lib/knowledge/retrieve.ts` | Top library entries for recent user messages, plus any offered or named exercise. |
| Safety engine | `src/lib/safety/crisis.ts` | Deterministic crisis replies (never sent to the model), distress safety checks, crisis text withheld from later turns, safety-check answers escalated. |
| Prompt assembly | `src/lib/agent/prompt.ts`, `turn.ts` | Persona, principles, boundaries, flow, examples, reference notes, safety notes, and the **turn plan** last. |
| Model integration | `src/lib/server/groq.ts`, `src/app/api/chat/route.ts` | Streaming; on a rate limit, retries once on the paired model; falls back to the scripted engine. |
| Scripted engine | `src/lib/agent/demo-engine.ts` | Offline and fallback replies. Follows the same turn plan (lower pressure, summary, permission before ideas, no unprompted exercises). |
| Voice controller | `src/lib/voice/controller.ts`, `check-in.ts` | Half-duplex turn-taking, interruption, mute, adaptive end-of-turn pause, silence check-ins. |

## Conversational moves

Each turn gets one move, checked in priority order:

1. **safety**: distress, or an earlier crisis in the conversation. Validate, say a crisis line is available, and ask directly about self-harm.
2. **close**: the user is saying goodbye.
3. **comfort**: grief or hard news in the last three turns. Short and warm, offering nothing.
4. **respect-boundary**: the user declined to share. Accept it, never return to it, and offer a different direction.
5. **repair**: "not really", "you're not listening", "whatever". Own the miss and re-reflect tentatively.
6. **guide**: an offered exercise was accepted. Guide that exact exercise.
7. **advise-direct**: the user asked for help ("what should I do", "skip the chat", "tips"), or said yes to hearing ideas. Give 2–3 concise, evidence-informed suggestions (at most 2 in voice), then check which fits.
8. **inform**: "what is…", "why…", "explain…". Plain explanation from the library, then check it fits their experience.
9. **follow-lead**: a topic change or request. Go with it fully.
10. While the topic is difficult:
    - two or more one-word answers in a row → **lower-pressure**;
    - after four exploring turns → **summarize**;
    - after a summary → **ask-permission** ("ideas, or keep talking?");
    - after two question turns in a row → **reflect-only** (hold space, no question);
    - otherwise → **reflect-explore**: name the feeling, then one open question, with no advice.
11. Light conversation: **casual** (acknowledge specifically, then one curious follow-up), or **lower-pressure** for repeated one-word answers.

The move is stored on each assistant message (`meta.strategy`), so later turns know how long Ari has been exploring, whether it has summarised, and whether it has asked permission.

## What changed and why

| Problem seen | Change | Research rule |
|---|---|---|
| Exercises offered right after a disclosure; "one small thing to reconnect" before Ari understood anything | Explore before solving. Ideas only after a summary and permission, or on request. The scripted engine no longer offers unprompted. | No advice before understanding; Elicit–Provide–Elicit |
| Facts repeated back while the feeling was missed ("haven't spent time together" instead of "you feel ignored") | Reflect the emotion underneath; read imperfect English charitably | Complex reflection / reflection of feeling |
| "How long…?" asked every turn; "It sounds like…" every turn | Question kinds already asked are banned per conversation; openers must vary | Avoid the question–answer trap; at most one stem in a row |
| Every reply ended in a question | reflect-only and hold-space moves; question policy per move | R:Q ≥ 2:1 in emotional stretches |
| Grief got techniques ("a way to honour his memory") | comfort move: offer nothing, no reframes | Don't challenge or fix in grief |
| One-word answers met with more probing | lower-pressure move: statements or an easy choice | Easier questions or choices for short answers |
| A user who wanted tips got feelings questions | advise-direct, and keeps tailoring help as they add detail | Direct-support users skip small talk |
| "not feeling good stressed…" scored as **positive** | Negation scoped to the clause and stopped at the next sentiment word | — |
| No recovery from a missed reflection | repair move | Rupture repair |
| Silence check-ins asked questions even in heavy moments | In a hard conversation the check-in is "No rush… I'm here", with no question | Hold space; never "are you still there?" |
| Voice replied too quickly after emotional questions | End-of-turn pause is 2.2 s after reflective moves, 1.4 s otherwise | Allow longer pauses in voice |
| Stock sympathy, flattery, means information, retention | Prompt rules forbid them; Ari encourages human connection | Anti-sycophancy; safe messaging; APA advisory |
| "I want to be with him again" after a loss was not flagged | Added as a distress cue, so Ari asks directly about safety | Ask directly about suicide when warranted |
| "kind of quiet" (an answer) was treated as a correction; "ok what else?" after tips was treated as accepting an exercise | Soft corrections ("not really", "kind of, but…") only trigger repair right after a reflection; follow-ups to advice stay as advice | — (found in the live scenario run) |
| After a crisis reply, Ari offered to "give" a crisis number instead of saying it | The post-crisis safety note tells the model to say the number itself | Safe messaging: make help concrete |

## Testing

- `npm test` runs four suites:
  - `test:agent`: scripted conversation flow, about 300 checks;
  - `test:strategy`: move selection, including the reported "wife" transcript;
  - `test:safety`: crisis screening, withholding, escalation;
  - `test:voice`: microphone and speech lifecycle, check-ins.
- `npm run eval:scenarios` runs 10 multi-turn scenarios against live Groq: happy and casual, work stress, lonely, family relationship, one-word answers, private, emotional, topic change, wants advice, and self-harm. It writes transcripts for review. It uses your Groq quota.
- `npm run eval:prompt` runs the A/B evaluation of the few-shot examples.

Engagement length and amount of disclosure are **not** success measures. Transcripts are judged on naturalness, reflection quality, question relevance, autonomy, privacy and safety (rubric in the research guide, section 5).

## Limitations

- The safety screen is rule-based and English-only. It is a safeguard, not a clinical risk assessment. A clinician should review the safety scripts before any real use.
- Moves are chosen by heuristics: sentiment lexicons and pattern matching. They can misread sarcasm, mixed feelings or unusual phrasing. Groq then writes the actual words and does not always follow the directive exactly; voice length limits in particular are sometimes exceeded.
- Voice is half-duplex: the mic is closed while Ari speaks, so you interrupt with the Interrupt button or Space. Barge-in by speaking isn't supported, because echo would make it unreliable without dedicated echo cancellation.
- Ari doesn't infer anything from tone of voice or pauses (by design), and doesn't detect emotion in audio.
- The research guide notes evidence gaps: findings on counsellor communication come from human therapy and have not been validated as outcome predictors for AI companions.
