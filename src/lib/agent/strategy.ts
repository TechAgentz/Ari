import type { ChatMessage, ConversationState, SafetyLevel } from "../types";
import { extractFacts } from "./extract";

/**
 * Conversation strategy engine.
 *
 * Picks ONE conversational move per turn from evidence-informed counselling
 * communication (person-centred reflection, Motivational Interviewing OARS,
 * trauma-informed choice, safe-messaging). It is model-agnostic: the move's
 * directive is injected into the Groq prompt, and the scripted engine reads the
 * same move. See docs/communication-research.md for the rationale and sources.
 *
 * Core rules it encodes:
 * - Explore before solving: reflect the feeling under the words and ask an open
 *   question for a couple of turns before any advice, unless the user asks for help.
 * - Summarise after several disclosures, then ask permission before offering ideas.
 * - Grief and acute hurt get comfort, not techniques or reframes.
 * - Short or one-word answers get less pressure, not more questions.
 * - Declines and topic changes are followed immediately.
 * - Not every reply needs a question.
 */

export type Move =
  | "safety"
  | "comfort"
  | "respect-boundary"
  | "follow-lead"
  | "advise-direct"
  | "inform"
  | "guide"
  | "reflect-explore"
  | "reflect-only"
  | "summarize"
  | "ask-permission"
  | "lower-pressure"
  | "repair"
  | "casual"
  | "close";

export interface TurnPlan {
  move: Move;
  /** Instruction for this reply, injected into the system prompt. */
  directive: string;
  /** Whether this reply should end with a question. */
  question: "required" | "optional" | "none";
  /** What the conversation is currently about, in plain words (for the prompt). */
  focus?: string;
}

/** Moves that count as exploring a difficulty (before ideas are offered). */
const EXPLORING: Move[] = ["reflect-explore", "reflect-only", "comfort", "follow-lead"];

const ADVICE_REQUEST =
  /\b(what (would|should|could|can) (you suggest|i do|i try|help)|what do you (suggest|recommend|think i should)|any (advice|tips|ideas|suggestions)|give me (some )?(tips|advice|ideas)|how (do|can) i (stop|fix|deal|cope|handle|get|fall|sleep|calm|manage)|practical (tips|advice|help)|tell me what to do|what else)\b/i;
const SMALL_TALK_SKIP = /\b(skip (the )?(small talk|chat)|get to the point|no small talk|just (tell|give) me)\b/i;

/** "Not really" after a reflection, or rupture signals ("you're not listening", "whatever", "you're just a bot"). */
const REPAIR =
  /^(no,? (that'?s not|it'?s not) (it|what i (mean|meant|said))|that'?s not (it|what i meant)|you'?re not (listening|getting it)|you don'?t (get|understand) (it|me)|whatever|you'?re just a (bot|machine|program)|that'?s not helpful|this (isn'?t|is not) helping)\b/i;
/** Soft corrections ("not really, it's more…", "kind of, but…") only count as repair right after a reflection. */
const SOFT_REPAIR = /^(not really|not exactly|(kind of|kinda|sort of)\s*(,|\.|$|but\b))/i;
const REFLECTIVE: Move[] = ["reflect-explore", "reflect-only", "summarize", "comfort"];

const DIRECTIVES: Record<Move, string> = {
  repair:
    "THIS TURN: Your last reply missed the mark, or they seem frustrated. Briefly own it without over-apologising (\"I may have got that wrong\"), thank them, re-reflect more tentatively, and invite them to put it in their own words. Never argue or defend the earlier reflection, and change your approach.",
  safety: "THIS TURN: Safety first (see the safety note). Validate, mention that a crisis line can talk any time, and ask directly and gently about thoughts of harming themselves. Nothing else.",
  comfort:
    "THIS TURN: They're hurting. Slow down and keep it short (1–2 sentences). Name the feeling simply and warmly. Offer nothing — no techniques, ways to cope, ideas, silver linings, reframes or 'at least…'. Either stay with them without a question, or ask one gentle, permission-based question (e.g. about who or what they lost, or what would help right now).",
  "respect-boundary":
    "THIS TURN: They declined to share something. Accept it in a few words, don't ask why, don't apologise at length, and never return to it. Offer a different direction or let them choose what to talk about.",
  "follow-lead":
    "THIS TURN: They've chosen or changed the topic. Follow it fully — don't steer back to earlier topics or the conversation plan. Reflect what they said about it, then ask one open question about it.",
  "advise-direct":
    "THIS TURN: They want practical help now — respect that and skip small talk or long exploration. Give concise, evidence-informed suggestions drawn from the reference notes, tailored to what they've told you and not repeating ones you already gave (chat: 2–3 suggestions; voice: ONE or TWO suggestions only, under 60 spoken words, no lists). End by asking which might fit, or what they've already tried.",
  inform:
    "THIS TURN: They asked to understand something. Explain it clearly in plain language using the reference notes (voice: up to ~90 spoken words; chat: up to ~150 words), then check whether it fits their experience.",
  guide: "THIS TURN: They accepted the exercise you offered. Guide that same exercise briefly, step by step (voice: plain spoken steps, no lists), then check in on how it felt.",
  "reflect-explore":
    "THIS TURN: Reflect the feeling underneath what they said, in your own words — name the emotion (e.g. hurt, ignored, overwhelmed, alone), don't just repeat their facts. Then ask ONE open question (what/how, not why) about something you don't know yet — what's been happening, how it affects them day to day, what they wish were different, or what they've tried. No advice, exercises, tips or 'one small thing' yet.",
  "reflect-only":
    "THIS TURN: Give a thoughtful reflection of what they've shared and how it seems to feel — and don't ask a question this time. Leave space for them to continue.",
  summarize:
    "THIS TURN: Offer a short collecting summary of what they've shared so far (2–3 key points, including the feeling), in a natural voice, and check you've understood it right. No advice yet.",
  "ask-permission":
    "THIS TURN: Briefly reflect where they are, then ask permission before offering anything: would they like a couple of ideas that help others in similar situations, or would they rather keep talking it through? Don't give the ideas yet.",
  "lower-pressure":
    "THIS TURN: They're giving short answers — lower the pressure. Don't ask another probing open question. Either make a short, warm statement that leaves the door open (no question), or ask one very easy, concrete either/or question. Make it clear it's fine not to talk much.",
  casual:
    "THIS TURN: Light, curious conversation. Acknowledge specifically what they said (no generic praise or exclamation-heavy enthusiasm), then ask one natural follow-up about their life that builds on it. Don't hunt for problems.",
  close: "THIS TURN: They're wrapping up. Thank them warmly and briefly, remind them you're here any time. No question.",
};

const QUESTION_POLICY: Record<Move, TurnPlan["question"]> = {
  repair: "optional",
  safety: "required",
  comfort: "optional",
  "respect-boundary": "optional",
  "follow-lead": "required",
  "advise-direct": "required",
  inform: "optional",
  guide: "required",
  "reflect-explore": "required",
  "reflect-only": "none",
  summarize: "optional",
  "ask-permission": "required",
  "lower-pressure": "optional",
  casual: "required",
  close: "none",
};

const plan = (move: Move, focus?: string): TurnPlan => ({ move, directive: DIRECTIVES[move], question: QUESTION_POLICY[move], focus });

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const endsWithQuestion = (t: string) => /\?\s*["')\]]*\s*$/.test(t.trim());

/**
 * Plans the next reply. `messages` must end with the user's latest message.
 * Assistant messages may carry meta.strategy from earlier turns.
 */
export function planTurn(messages: ChatMessage[], state: ConversationState, safety: SafetyLevel, priorCrisis = false): TurnPlan {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return plan("casual");
  const text = last.content;
  const f = state.lastFacts ?? extractFacts(text, state.lastTopic);
  const focus = f.concerns[0] ?? (f.hardNews ? `their ${f.hardNews === "loss" ? "loss" : f.hardNews}` : undefined);

  // 1. Safety and boundaries always win.
  if (safety === "distress" || priorCrisis) return plan("safety", focus);
  if (f.goodbye && f.sentiment >= -0.5) return plan("close");
  if (f.hardNews || f.wantsToVent) return plan(f.wantsToVent ? "reflect-explore" : "comfort", focus);
  // 2. Explicit requests: the user leads.
  const assistantTurns = messages.filter((m) => m.role === "assistant");
  const prev = assistantTurns.at(-1);
  const wantsHelp = SMALL_TALK_SKIP.test(text) || ADVICE_REQUEST.test(text);
  if (f.skip && !wantsHelp) return plan("respect-boundary");
  // A specific exercise was offered and accepted: guide it.
  if (state.pendingTechnique && f.affirmative && !f.negative) return plan("guide", focus);
  // Answer to "would you like some ideas, or keep talking?"
  if (prev?.meta?.strategy === "ask-permission") {
    if (f.negative || /\b(keep talking|talk (it )?through|just talk|not yet|no thanks)\b/i.test(text)) return plan("reflect-explore", focus);
    if (f.affirmative || /\b(ideas?|yes|sure|please|go ahead)\b/i.test(text)) return plan("advise-direct", focus);
  }
  if (state.lastTopic === "technique" && f.affirmative && !f.negative && prev?.meta?.strategy !== "advise-direct") return plan("guide", focus);
  if (f.asksExplanation && !f.asksDiagnosis) return plan("inform", focus);
  // Repair after a missed reflection or a rupture (research rules 9 and 27).
  const prevMove = prev?.meta?.strategy as Move | undefined;
  const t = text.trim();
  if (prev && prevMove !== "repair" && (REPAIR.test(t) || (SOFT_REPAIR.test(t) && prevMove && REFLECTIVE.includes(prevMove)))) return plan("repair", focus);
  if (wantsHelp || (f.wantsTechnique && !f.techniqueRequest)) return plan("advise-direct", focus);
  // They asked for practical help and are now adding details: tailor the help, don't switch to probing feelings.
  if (prev?.meta?.strategy === "advise-direct" && !f.negative && !f.hardNews && f.sentiment > -2) return plan("advise-direct", focus);
  if (f.topicRequest) return plan("follow-lead", focus);

  // 3. Where are we in exploring a difficulty?
  // Count the run of recent assistant replies spent exploring, and whether a summary or offer happened.
  let exploring = 0;
  let summarized = false;
  let permissionAsked = false;
  for (const m of [...assistantTurns].reverse()) {
    const mv = m.meta?.strategy as Move | undefined;
    if (!mv) break;
    if (EXPLORING.includes(mv)) exploring++;
    else if (mv === "summarize") summarized = true;
    else if (mv === "ask-permission" || mv === "advise-direct" || mv === "guide") {
      permissionAsked = true;
      break;
    } else break;
  }
  const userTurns = messages.filter((m) => m.role === "user");
  const shortStreak = (() => {
    let n = 0;
    for (const m of [...userTurns].reverse()) {
      if (words(m.content) <= 2 && !/\b(yes|yeah|sure|ok(ay)?)\b.*\?/.test(m.content)) n++;
      else break;
    }
    return n;
  })();
  const difficult = f.sentiment < 0 || f.concerns.length > 0 || state.userLed || exploring > 0;
  // Grief or hard news in the last few turns: stay with comfort and reflection — no summaries that turn into offers.
  const recentNews = userTurns.slice(-3).some((m) => extractFacts(m.content).hardNews);
  if (recentNews && !permissionAsked) {
    return plan("comfort", focus);
  }

  if (difficult) {
    if (f.negative && permissionAsked) return plan("reflect-explore", focus); // "no thanks" to ideas: keep listening
    if (permissionAsked && f.affirmative) return plan("advise-direct", focus);
    if (shortStreak >= 2) return plan("lower-pressure", focus);
    if (exploring >= 4 && !summarized) return plan("summarize", focus);
    if ((summarized || exploring >= 6) && !permissionAsked) return plan("ask-permission", focus);
    // Long emotional disclosure after two questions in a row: reflect without another question.
    const lastTwoAsked = assistantTurns.slice(-2).length === 2 && assistantTurns.slice(-2).every((m) => endsWithQuestion(m.content));
    // After two question-bearing turns in a hard stretch, hold space without a question (research rule 6).
    if (lastTwoAsked && exploring >= 2 && (words(text) >= 6 || f.sentiment < 0)) return plan("reflect-only", focus);
    return plan("reflect-explore", focus);
  }

  // 4. Light conversation.
  if (shortStreak >= 2) return plan("lower-pressure");
  if (prev && words(text) <= 2 && endsWithQuestion(prev.content) && !f.affirmative && !f.negative && shortStreak >= 1 && userTurns.length > 2) return plan("lower-pressure");
  return plan("casual");
}

/** Question kinds already used by Ari in this conversation, so they aren't repeated. */
const QUESTION_KINDS: [string, RegExp][] = [
  ["how long it has been going on", /\bhow long\b|\bsince when\b/i],
  ["the hardest part", /\bhardest part\b|\bweighing on you the most\b/i],
  ["their sleep or energy", /\b(sleep|energy)\b[^.?!]*\?/i],
  ["what's been happening", /\bwhat'?s been (going on|happening)\b/i],
  ["one small thing they could do", /\bone (small|tiny) (thing|step)\b/i],
  ["who they spend time with", /\bwho do you (usually )?(spend time|celebrate|hang out)\b/i],
];

export function usedQuestionKinds(messages: ChatMessage[]): string[] {
  const asked = messages.filter((m) => m.role === "assistant").map((m) => m.content);
  return QUESTION_KINDS.filter(([, re]) => asked.some((t) => re.test(t))).map(([k]) => k);
}

/** Prompt section for the planned move. */
export function formatPlan(p: TurnPlan, voice: boolean, avoid: string[] = []): string {
  const q = p.question === "none" ? "Do not ask a question in this reply." : p.question === "optional" ? "A question is optional — only if it truly helps." : "End with exactly one question.";
  return [
    p.directive,
    q,
    "Vary your wording: don't open with \"It sounds like\" or \"It feels like\" if you've used it recently — sometimes just say the reflection directly.",
    avoid.length ? `You've already asked about ${avoid.join(", ")} — don't ask about that again.` : "",
    p.focus ? `Current focus: ${p.focus}.` : "",
    voice ? "This will be spoken aloud: short sentences, natural rhythm, no lists." : "",
    voice && p.move === "advise-direct" ? "Voice limit: at most two suggestions this turn — save the rest for if they ask." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
