import { APP } from "../config";
import { getEntry, type KnowledgeEntry } from "../knowledge/base";
import { retrieveKnowledge, type RetrievalHit } from "../knowledge/retrieve";
import { assessRisk, crisisResponse } from "../safety/crisis";
import type { ChatMessage, ConversationState, MessageFacts, MessageMeta, StageId } from "../types";
import { extractFacts } from "./extract";
import { pickNextQuestion, type Question } from "./questions";
import { planTurn, type TurnPlan } from "./strategy";

/**
 * Scripted fallback conversation engine. Used when the AI provider is set to
 * "demo", when the user hasn't consented to sending messages to an AI
 * provider, or when Groq is unavailable. Builds a reply from: a reflection
 * of what the user said, optional knowledge, and at most one question.
 */

export interface EngineReply {
  text: string;
  meta: MessageMeta;
}

type Mode = "chat" | "voice";

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function seedOf(s: ConversationState, text: string): number {
  let h = s.userTurns * 31;
  for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
  return h;
}

/** A line not used in the last few replies, so nothing is repeated word for word. */
function freshLine(options: string[], recent: string[], seed: number): string | undefined {
  const unused = options.filter((o) => !recent.some((r) => r.includes(o)));
  return unused.length ? pick(unused, seed) : undefined;
}

const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export function openingMessage(mode: Mode, seed = Date.now()): EngineReply {
  const chat = [
    `Hi there, I'm ${APP.companion}, your ${APP.role}. I work alongside ${APP.careTeam} and I'm here to chat and listen. How's your day going so far?`,
    `Hello! I'm ${APP.companion}, a ${APP.role} working alongside ${APP.careTeam}. It's nice to meet you. How has today been treating you?`,
  ];
  const voice = [`Hi, I'm ${APP.companion}, your ${APP.role}. I work alongside ${APP.careTeam}. How's your day going so far?`];
  return {
    text: pick(mode === "voice" ? voice : chat, Math.floor(seed / 1000)),
    meta: { provider: "demo", stage: "intro", topic: "day", questionId: "intro_day" },
  };
}

// ───────────────────────── Acknowledgements ─────────────────────────

/** "Nothing much", "not really": never met with an upbeat line. */
const NOTHING_MUCH =
  /^(nothing|not much|not a lot|not really|nah|no|nope|none)\b|\b(anymore|any more|(don'?t|do not|never|hardly|rarely) (really |ever |even )?(do|get|have|go|see)|not (much|a lot) (lately|these days|anymore))\b/i;
const NOTHING_WRONG = /^(nothing|not much|not a lot|no|nope|nah|all good|(i'?m|it'?s|everything'?s|all) (fine|good|ok(ay)?|alright|great)|not (at the moment|right now|today|really))\b/i;
const GREETING_ONLY = /^(hi|hey|hello|hiya|heya|yo|good (morning|afternoon|evening)|morning|evening)[!. ]*(there|ari)?[!. ]*$/i;

function acknowledge(s: ConversationState, seed: number, mode: Mode, text: string): string {
  const f = s.lastFacts;
  if (!f) return "";
  const m = s.memory;
  const t = s.lastTopic;

  if (f.skip) return pick(["Of course — no need to share that.", "That's completely fine, we can skip that.", "No problem at all."], seed);

  if (t === "name" && f.name) return pick([`Lovely to meet you, ${f.name}.`, `It's really nice to meet you, ${f.name}.`], seed);

  if (t === "day" || s.userTurns === 1) {
    const hello = f.name ? `Lovely to meet you, ${f.name}. ` : "";
    if (GREETING_ONLY.test(text)) return "Hi! It's lovely to hear from you.";
    if (f.asksAboutCompanion && wordCount(text) <= 4 && f.sentiment === 0) return hello.trim();
    if (m.dayMood === "positive") return hello + pick(["Glad to hear it's been a good one.", "That's really nice to hear.", ...(hello ? [] : ["Love that."])], seed);
    if (m.dayMood === "negative") return hello + pick(["I'm sorry it's been a tough one.", "That sounds like a heavy day.", "Oof, that sounds like a rough day."], seed);
    return hello + pick(["Fair enough — some days are just steady.", "Got it, one of those in-between days.", "Thanks for sharing."], seed);
  }

  if (t === "stress" && s.skipped.includes("stress")) return pick(["Sure, let's keep things light for a bit.", "Absolutely — a little distraction can be nice."], seed);
  if (t === "stress" && NOTHING_WRONG.test(text)) return pick(["That's good to hear.", "Glad to hear it."], seed);

  // Difficult, empty or off-topic answers never get the upbeat topic lines below.
  if (t === "support_network" && f.noSupport)
    return pick(
      ["That can feel really isolating at times. I'm glad you're talking with me now.", "Thank you for being honest about that. It's hard when there's no one to lean on — I'm glad you're here."],
      seed,
    );
  if (f.sentiment < 0) return reflect(s, seed, mode);
  if (f.negative || NOTHING_MUCH.test(text)) return pick(["That's okay.", "Fair enough.", "That's completely fine."], seed);
  if (/\?\s*$/.test(text)) return pick(["Fair question — everything here is optional.", "Totally fair to ask — no need to answer anything you'd rather not."], seed);

  if (f.household && m.household) {
    switch (m.household.kind) {
      case "alone":
        return "Having your own space can be really nice — and sometimes a bit quiet too.";
      case "partner":
        return "It sounds like you share your home with someone close.";
      case "family":
        return pick(["So home is with family.", "Family under one roof — that can be lovely and busy at the same time."], seed);
      case "roommates":
        return "Living with housemates can be fun, and occasionally a little chaotic.";
      case "friends":
        return "Living with friends sounds like it could be a lot of fun.";
      case "pets":
        return "A furry housemate absolutely counts.";
      default:
        return "Thanks for sharing that.";
    }
  }
  if (t === "household_size" && f.householdSize && m.householdSize) {
    return m.householdSize >= 4 ? `${m.householdSize} of you — that's a lively household.` : `${m.householdSize} of you — that sounds cosy.`;
  }
  if (t === "together") return pick(["That sounds like a really nice way to spend time.", "I love that.", "That sounds lovely."], seed);
  if (t === "support_network")
    return f.supportPerson ? pick(["It's good to have someone like that.", "That's really valuable."], seed) : pick(["Thanks for sharing that.", "That makes sense."], seed);
  if ((t === "occupation" || f.occupation) && m.occupation) {
    if (m.occupation.kind === "study") return pick(["Studying takes a lot of energy.", `${capitalize(m.occupation.detail)} — that's quite a lot to juggle.`], seed);
    if (m.occupation.kind === "work") return pick(["That sounds like it keeps you busy.", `Ah, so you ${m.occupation.detail.replace(/^works/, "work")}.`], seed);
    return "Thanks for telling me a bit about that.";
  }
  if (f.interests.length) {
    const interest = f.interests[0];
    return pick([`${capitalize(interest)} — that's a lovely way to spend time.`, `Oh, ${interest} sounds great.`, `I like the sound of ${interest}.`], seed);
  }
  if (t === "routine") return pick(["That gives me a good picture of your days.", "Sounds like a full day."], seed);
  if (t === "positive") {
    if (f.sentiment < 0 || f.negative) return pick(["Thanks for being honest about that.", "That's okay — not everything has to feel bright right now."], seed);
    if (f.sentiment > 0 || f.affirmative) return pick(["That's really good to hear.", "I'm really glad about that.", "That's lovely."], seed);
    return pick(["Thanks for sharing that.", "That makes sense."], seed);
  }
  if (f.sentiment > 0.8) return pick(["That's really good to hear.", "I'm really glad about that.", "That's lovely."], seed);
  return pick(["Thanks for sharing that.", "I appreciate you telling me.", "That makes sense.", "Got it."], seed);
}

const CONCERN_EMPATHY: Record<string, string> = {
  sleep: "Lying awake can be so draining, especially when your mind won't switch off.",
  "study pressure": "Exams and deadlines can bring a lot of pressure all at once.",
  "work stress": "Work pressure has a way of seeping into everything else.",
  loneliness: "Feeling lonely can be really painful, and it's more common than people let on.",
  worry: "Worry can be exhausting, especially when it keeps looping.",
  "low mood": "Low stretches can make everything feel heavier.",
  stress: "It sounds like a lot has been piling up.",
  panic: "Those surges of panic can feel really frightening.",
  loss: "Loss can be so heavy, and there's no right way to carry it.",
  frustration: "That kind of frustration can build up fast.",
  "relationship tension": "Tension with people close to us can be really draining.",
  overthinking: "Getting stuck in loops of thinking is exhausting.",
  procrastination: "That stuck feeling around tasks is really common — and really frustrating.",
  "self-criticism": "It sounds like you've been really hard on yourself.",
  "difficult thoughts": "Those thoughts sound really heavy to carry around.",
  boundaries: "It can be hard to protect your own time and energy.",
  heartbreak: "Heartbreak can hurt in a really physical way, and it takes time.",
  "feeling upset": "It sounds like you've been hurting a lot.",
  "a health worry": "Health worries — yours or someone you love — can take over everything.",
  "job loss": "Losing a job is a real shock, and it can shake a lot more than your plans.",
  "housing worries": "Not feeling secure about where you live is really stressful.",
};

/** Feeling words that read naturally after "feel" (nouns and phrases mapped to adjectives; others are left out). */
const FEELING_ADJECTIVES: Record<string, string> = {
  stressed: "stressed", stress: "stressed", anxious: "anxious", anxiety: "anxious", worried: "worried", worry: "worried",
  nervous: "nervous", overwhelmed: "overwhelmed", "too much": "overwhelmed", swamped: "swamped", drowning: "overwhelmed",
  "piling up": "overwhelmed", sad: "sad", down: "down", low: "low", lonely: "lonely", isolated: "isolated", tired: "tired",
  exhausted: "exhausted", drained: "drained", "burned out": "burned out", "burnt out": "burnt out", burnout: "burned out",
  angry: "angry", frustrated: "frustrated", irritated: "irritated", annoyed: "annoyed", "fed up": "fed up", empty: "empty",
  numb: "numb", scared: "scared", afraid: "afraid", panicky: "panicky", panicking: "panicky", upset: "upset", hurt: "hurt",
  heartbroken: "heartbroken", devastated: "devastated", gutted: "gutted", lost: "lost", stuck: "stuck", unmotivated: "unmotivated",
  restless: "restless", guilty: "guilty", ashamed: "ashamed", confused: "confused", miserable: "miserable", insecure: "insecure",
  jealous: "jealous", tense: "tense", "on edge": "on edge", pressure: "under pressure", "can't switch off": "wound up",
  "can't relax": "wound up", awful: "awful", terrible: "terrible", horrible: "horrible",
};

function reflect(s: ConversationState, seed: number, mode: Mode): string {
  const f = s.lastFacts;
  const feeling = f?.emotions.map((e) => FEELING_ADJECTIVES[e]).find(Boolean);
  const concern = f?.concerns[0];
  if (concern && CONCERN_EMPATHY[concern] && seed % 2 === 0) return CONCERN_EMPATHY[concern];
  const options = [
    "That sounds really hard.",
    "That sounds like a lot to carry.",
    "I'm sorry you're dealing with that.",
    "It makes sense that you'd feel that way.",
  ];
  if (feeling) options.push(`Feeling ${feeling} like that can be really draining.`, `It's understandable to feel ${feeling} with all that going on.`);
  if (concern && mode === "chat") options.push(CONCERN_EMPATHY[concern] ?? `It sounds like ${concern} has been taking up a lot of space lately.`);
  return pick(options, seed);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One variant of the question that wasn't asked in the last few replies ("" if every variant was). */
function questionText(q: Question, s: ConversationState, seed: number, recent: string[] = [], rotate?: number): string {
  const variants = q.ask(s);
  const unused = variants.filter((v) => !recent.some((r) => r.includes(v)));
  return unused.length ? unused[Math.abs(rotate ?? seed) % unused.length] : "";
}

function techniqueText(slug: string, mode: Mode): string {
  const entry = getEntry(slug);
  if (!entry?.technique) return "";
  const t = entry.technique;
  if (mode === "voice") return t.voiceScript;
  return `**${t.name}** (${t.duration}):\n${t.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`;
}

/** Walk through a technique now and check in afterwards. */
function guideTechnique(entry: KnowledgeEntry, mode: Mode, base: MessageMeta, intro: string): EngineReply {
  return {
    text:
      mode === "voice"
        ? `${intro} ${entry.technique!.voiceScript} Take your time. How do you feel now?`
        : `${intro}\n\n${techniqueText(entry.slug, mode)}\n\nTake your time with it — there's no right or wrong way. How do you feel afterwards?`,
    meta: { ...base, stage: "support", topic: "support_followup", questionId: `tech_${entry.slug}`, techniqueGiven: entry.slug, sources: [{ slug: entry.slug, title: entry.title }] },
  };
}

function recentUserText(messages: ChatMessage[], n = 2): string {
  return messages
    .filter((m) => m.role === "user")
    .slice(-n)
    .map((m) => m.content)
    .join(" ");
}

const ACCEPT_EXTRA = /\b(i'?ll (try|give it a (go|try|shot))|let'?s (do|try) (it|that|this)|go on|sounds (good|great|helpful|nice|lovely)|would (really )?help|why not)\b/i;

/** "Yes", "I'd love that", "go on then", or a short positive reply to an offer. */
function accepts(f: MessageFacts, text: string): boolean {
  if (f.negative || f.skip || f.topicRequest || f.wantsToVent || f.hardNews || f.asksIfAI || f.asksDiagnosis) return false;
  return f.affirmative || ACCEPT_EXTRA.test(text) || (f.sentiment > 0 && wordCount(text) <= 6 && f.concerns.length === 0);
}

// ───────────────────────── Main entry ─────────────────────────

/**
 * The scripted engine follows the same turn plan (strategy engine) as the Groq path:
 * lower the pressure after one-word answers, summarise after several disclosures, ask
 * permission before offering ideas, and never offer exercises unprompted.
 */
export function generateDemoReply(messages: ChatMessage[], s: ConversationState, mode: Mode): EngineReply {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const risk = assessRisk(lastUser);
  const priorCrisis = messages.some((m) => m.meta?.safety === "crisis");
  const turnPlan = planTurn(messages, s, risk.level, priorCrisis);
  const seed = seedOf(s, lastUser);
  const base: MessageMeta = { provider: "demo", stage: "support", strategy: turnPlan.move };
  if (risk.level === "none" && !priorCrisis && !s.pendingTechnique) {
    if (turnPlan.move === "lower-pressure") {
      return {
        text: pick(
          [
            "That's okay — there's no pressure to talk. I'm here if anything comes to mind.",
            "Fair enough. We can keep things light or take it slow, whatever suits you.",
            "No worries. Some days there isn't much to say, and that's fine.",
          ],
          seed,
        ),
        meta: { ...base, stage: s.stage },
      };
    }
    if (turnPlan.move === "summarize") {
      const concerns = s.memory.concerns.slice(-2);
      const feelings = s.memory.feelings.filter((x) => !x.startsWith("not ") && /^[a-z]+(ed|ous|ry|y|ely|lone)?$/.test(x)).slice(-2);
      const what = concerns.length ? concerns.join(" and ") : "a lot";
      const feel = feelings.length ? `, and you've been feeling ${feelings.join(" and ")}` : "";
      return {
        text: `Let me check I've understood: ${what === "a lot" ? "there's been a lot going on" : `${what} ${concerns.length > 1 ? "have" : "has"} been weighing on you`}${feel}. Does that sound right?`,
        meta: { ...base, topic: "support_followup", questionId: `summary_${s.userTurns}` },
      };
    }
    if (turnPlan.move === "ask-permission") {
      const hit = retrieveKnowledge(messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join(" "), 3, 3).find((h) => h.entry.technique && !s.givenTechniques.includes(h.entry.slug));
      return {
        text: "Thank you for walking me through all of that. Would it help if I shared an idea that others find useful, or would you rather keep talking it through for now?",
        meta: { ...base, topic: "technique", techniqueOffered: hit?.entry.slug, questionId: `permission_${s.userTurns}` },
      };
    }
  }
  const reply = generateScriptedReply(messages, s, mode, turnPlan);
  return { ...reply, meta: { ...reply.meta, strategy: reply.meta.strategy ?? turnPlan.move } };
}

function generateScriptedReply(messages: ChatMessage[], s: ConversationState, mode: Mode, turnPlan: TurnPlan): EngineReply {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const lastText = last?.content ?? "";
  const seed = seedOf(s, lastText);
  const f = s.lastFacts;
  const base: MessageMeta = { provider: "demo", stage: s.stage };
  const name = s.memory.name;
  const recent = messages
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content);

  // 0. Safety first.
  const risk = assessRisk(lastText);
  if (risk.level === "crisis") {
    return { text: crisisResponse(risk.categories, mode), meta: { ...base, provider: "safety", safety: "crisis", safetyCategories: risk.categories, stage: "support" } };
  }
  const prevAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (prevAssistant?.meta?.safety === "crisis" && f) {
    const meta: MessageMeta = { ...base, stage: "support", safety: "distress", topic: "support_followup", questionId: `after_crisis_${s.userTurns}` };
    if (f.affirmative && !f.negative) {
      return {
        text:
          mode === "voice"
            ? "Thank you. That's a really brave step. If you can, reach out now, and I'll stay here with you. Is there someone nearby who could be with you too?"
            : "Thank you — that's a really brave step. If you can, reach out to them now; I'll stay right here with you.\n\nIs there someone nearby who could be with you too?",
        meta,
      };
    }
    if (f.negative || /\b(can'?t|won'?t|don'?t want to|no point)\b/i.test(lastText)) {
      return {
        text:
          mode === "voice"
            ? "That's okay. Reaching out can feel really hard. Some people find texting easier than calling: in the US or Canada you can text 988, and in the UK you can text SHOUT to 85258. What's making it feel hard to reach out?"
            : "That's okay — reaching out can feel really hard. Some people find texting easier than calling: in the US or Canada you can **text 988**, and in the UK you can **text SHOUT to 85258**.\n\nWhat's making it feel hard to reach out right now?",
        meta,
      };
    }
    return {
      text: `I'm here with you. ${reflect(s, seed, mode)} Please keep the crisis line in mind — they can help in ways I can't, any time. What's going on for you right now?`,
      meta,
    };
  }
  if (s.lastTopic === "safety_check" && f) {
    if (f.affirmative || /\b(yes|yeah|sometimes|a bit|kind of|i have)\b/i.test(lastText)) {
      return { text: crisisResponse(["suicide"], mode), meta: { ...base, provider: "safety", safety: "crisis", safetyCategories: ["suicide"], stage: "support" } };
    }
    if (f.negative || /\b(no|not|safe)\b/i.test(lastText)) {
      return {
        text: `Thank you for letting me know — I'm glad you're safe. It still sounds like things have been really heavy. ${mode === "voice" ? "" : "I'm here to listen for as long as you'd like. "}What's been the hardest part?`,
        meta: { ...base, stage: "support", topic: "support_followup", questionId: "sup_hardest" },
      };
    }
  }
  if (risk.level === "distress") {
    return {
      text:
        mode === "voice"
          ? "That sounds incredibly hard, and I'm really glad you told me. When things feel this heavy, some people have thoughts of harming themselves. Are you having any thoughts like that right now?"
          : "That sounds incredibly hard, and I'm really glad you told me. You don't have to carry it alone.\n\nWhen things feel this heavy, some people start having thoughts of harming themselves or not wanting to be here. Are you having any thoughts like that right now?",
      meta: { ...base, stage: "support", safety: "distress", topic: "safety_check", questionId: "safety_check" },
    };
  }

  if (!f) {
    const opening = openingMessage(mode, seed);
    return opening;
  }

  // 1. Questions about the companion itself.
  if (f.asksIfAI) {
    const q = pickNextQuestion(s);
    return {
      text: `I'm ${APP.companion}, a virtual assistant (AI-powered) working alongside ${APP.careTeam} — not a person, and not a psychologist or therapist myself. I can listen, share general wellbeing information and coping ideas, but I can't diagnose anything or replace professional care. ${q ? questionText(q, s, seed, recent) : ""}`.trim(),
      meta: { ...base, topic: q?.topic, questionId: q?.id, stage: q?.stage ?? s.stage },
    };
  }

  if (f.asksDiagnosis) {
    const seekHelp = getEntry("when-to-seek-help");
    return {
      text:
        mode === "voice"
          ? "I can't diagnose anything — I'm a virtual assistant, and only a qualified professional who can properly assess you could do that. If it's been affecting your daily life for a while, talking to a doctor or licensed therapist is a really good step. Would it help to talk about what you've been noticing?"
          : "That's a really understandable question, but I can't diagnose anything — I'm a virtual assistant, and only a qualified professional who can properly assess you can do that.\n\nWhat I can say is that if something has been affecting your daily life for more than a couple of weeks, it's a good time to talk with a doctor or licensed mental health professional. Would it help to talk through what you've been noticing?",
      meta: { ...base, stage: "support", topic: "support_followup", questionId: "sup_diagnosis", sources: seekHelp ? [{ slug: seekHelp.slug, title: seekHelp.title }] : undefined },
    };
  }

  // 1b. "What is…/why…/explain…" — share what the library says, then offer to go further.
  if (f.asksExplanation && !f.hardNews) {
    const hit = retrieveKnowledge(lastText, 1, 3)[0]?.entry;
    if (hit) {
      const offer = hit.technique && !s.givenTechniques.includes(hit.slug);
      const detail = mode === "voice" ? hit.insight : `${hit.body[0]}\n\n${hit.insight}`;
      const follow = offer
        ? `Would you like to try ${mode === "voice" ? "a short exercise for it" : `"${hit.technique!.name}"`} together?`
        : "Does that match what you've been noticing?";
      return {
        text: `${mode === "voice" ? hit.summary : `Good question. ${hit.summary}`} ${detail} ${follow}`.replace(/[ \t]{2,}/g, " ").trim(),
        meta: {
          ...base,
          stage: "support",
          topic: offer ? "technique" : "support_followup",
          questionId: `explain_${hit.slug}`,
          techniqueOffered: offer ? hit.slug : undefined,
          sources: [{ slug: hit.slug, title: hit.title }],
        },
      };
    }
  }

  // 2. Closing the conversation.
  if (f.goodbye) {
    return {
      text: `Thank you for talking with me today${name ? `, ${name}` : ""}. Take good care of yourself — I'm here whenever you'd like to chat again.${mode === "chat" ? " And if things ever feel like too much, the Get help page has people you can talk to any time." : ""}`,
      meta: { ...base },
    };
  }

  // 3. A technique was offered last turn (unless they asked for a different one by name).
  if (s.pendingTechnique && !(f.techniqueRequest && f.techniqueRequest !== s.pendingTechnique)) {
    const entry = getEntry(s.pendingTechnique);
    if (entry?.technique && accepts(f, lastText)) {
      return guideTechnique(entry, mode, base, mode === "voice" ? "Okay, let's do it together." : "Okay, let's try it together.");
    }
    if (f.negative || f.skip) {
      return {
        text: pick(
          [
            "That's completely okay — we don't have to try anything. Sometimes it just helps to talk. What feels most important to talk about right now?",
            "No problem at all. We can just keep talking. What's been on your mind the most?",
          ],
          seed,
        ),
        meta: { ...base, stage: "support", topic: "support_followup", questionId: "sup_after_decline" },
      };
    }
  }

  // 4. Supportive conversation.
  if (s.stage === "support") {
    const reply = supportReply(messages, s, mode, seed, base, recent, lastText, turnPlan);
    return { ...reply, text: reply.text.replace(/[ \t]{2,}/g, " ").trim() };
  }

  // 5. Relationship-building flow (stages 1–4).
  const ack = acknowledge(s, seed, mode, lastText);
  const companionAnswer = f.asksAboutCompanion
    ? pick(["I'm a virtual assistant, so I don't have days quite like you do — but I'm really glad to be chatting with you.", "Thanks for asking! I don't have days of my own, but this is a nice part of mine."], seed)
    : "";
  const q = pickNextQuestion(s);
  const text = [ack, companionAnswer, q ? questionText(q, s, seed + 7, recent) : ""].filter(Boolean).join(" ");
  return { text, meta: { ...base, stage: (q?.stage ?? s.stage) as StageId, topic: q?.topic, questionId: q?.id } };
}

// ───────────────────────── Supportive conversation ─────────────────────────

/** Asking for something calming: breathing comes first, then grounding, PMR, a mindful minute. */
const CALMING = /\b(calm|calming|relax|relaxing|breath|breathe|breathing|settle|soothe|soothing|anxious|anxiety|panic|panicky|nervous|tense)\b/i;
const CALMING_ORDER = ["paced-breathing", "grounding-5-4-3-2-1", "progressive-muscle-relaxation", "mindfulness-basics"];
/** Explicitly asking ("can we…", "I'd like…") rather than describing. */
const ASKED = /\b(can|could|may) (we|i)\b|\blet'?s\b|\bi('?d| would)? ?(want|like|love|need|rather|prefer)\b|\bwanna\b/i;
const EXPLICIT_TALK = /\b(talk|chat|speak|vent) (about|through)\b|\bon my mind\b|\bfocus on\b/i;
const CHOOSE_TALK = /\b(talk|talking|tell you|let it out|off my chest)\b/i;
const LOW_CONTENT =
  /^(fine|ok(ay)?|k|kk|sure|yeah|yep|yes|no|nope|nah|nothing( much| really)?|not much|not really|idk|i don'?t know|dunno|not sure|hmm+|mm+|meh|same|same old|whatever|i guess|maybe|all good|good|alright|cool|right|true|mhm|uh huh)[.!?]*$/i;
const PET = /\b(dog|cat|pet|puppy|kitten|hamster|rabbit|bird|horse)\b/i;

/** "Let's talk about work instead" → "work"; "my exams" → "your exams"; vague topics → undefined. */
function topicEcho(text: string): string | undefined {
  const m = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .match(/\b(?:talk|chat|speak) about (my |our |the )?([a-z' -]{2,30}?)(?:,? (?:instead|please|for a bit|for a while|now|today|a bit|first))?[?.!\s]*$/);
  if (!m) return undefined;
  const topic = m[2].trim();
  if (wordCount(topic) > 4 || /\b(something|anything|it|this|that|how|what|why|when|things|stuff|everything|whatever|me|myself|you|us|her|him|them)\b/.test(topic)) return undefined;
  return `${m[1] ? (m[1].trim() === "the" ? "the " : "your ") : ""}${topic}`;
}

/** How a technique went: "a bit better" vs "not really, I don't feel any better" vs "calmer, but still tense". */
function techniqueFeedback(f: MessageFacts, text: string): "better" | "mixed" | "worse" | "unsure" {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  if (/\b(not|n't|no)( \w+){0,2} (better|calmer|different|easier|helpful|good|great)\b|\bworse\b|\bdid ?n'?t (really )?(help|work|do much)\b|\bdid not (help|work)\b|\bno different\b|\bsame as before\b|\bnothing changed\b|^not really\b/.test(t) || f.negative)
    return "worse";
  const better = /\b(better|calmer|helped|relaxed|lighter|easier|less (tense|anxious|stressed|wound up)|it worked|that worked|nice|good|great|lovely|clearer|settled|grounded)\b/.test(t);
  if (better && (f.sentiment < 0 || /\bstill\b/.test(t))) return "mixed";
  if (better || f.sentiment > 0.5) return "better";
  if (f.sentiment < 0 || /\bstill\b/.test(t)) return "worse";
  return "unsure";
}

/** Careful first reply to bereavement, a breakup, illness, job or home loss, or tears. */
function hardNewsReply(kind: NonNullable<MessageFacts["hardNews"]>, text: string, seed: number): string {
  const who = text
    .toLowerCase()
    .match(
      /\bmy ((?:best |late |little |big |older |younger |old |dear )?(?:mum|mom|mother|dad|father|grandma|grandmother|grandpa|grandfather|grandad|granddad|nan|nana|gran|granny|sister|brother|son|daughter|husband|wife|partner|boyfriend|girlfriend|fianc[eé]e?|friend|aunt|auntie|uncle|cousin|niece|nephew|dog|cat|puppy|kitten|pet|hamster|rabbit|horse))\b/,
    )?.[1];
  switch (kind) {
    case "loss":
      return `${who ? `I'm so sorry about your ${who}.` : "I'm so sorry for your loss."} ${
        PET.test(who ?? "") ? "Losing a pet means losing a real companion, and that grief is real." : "Losing someone you love can turn everything upside down, and there's no right way to feel right now."
      } ${pick(["How are you holding up?", "Would you like to tell me a little about them?"], seed)}`;
    case "breakup":
      return "I'm really sorry. A breakup can hurt so much, and it can turn your days upside down. How are you holding up?";
    case "crying":
      return "I'm really sorry you're hurting this much. Crying like that can leave you completely worn out. Do you want to tell me what's been going on?";
    case "health":
      return "I'm so sorry — that's really frightening news to be carrying. How are you holding up with it all?";
    case "job":
      return "I'm sorry — losing a job is a real shock, and it can shake a lot more than your plans. How are you doing with it all?";
    case "home":
      return "That sounds really stressful — not knowing what's happening with your home is a lot to carry. How are you holding up?";
  }
}

function supportReply(messages: ChatMessage[], s: ConversationState, mode: Mode, seed: number, base: MessageMeta, recent: string[], lastText: string, turnPlan: TurnPlan): EngineReply {
  const f = s.lastFacts!;
  const supportTurns = s.stageQuestionCounts.support;
  const query = recentUserText(messages, 2);
  const hits = retrieveKnowledge(query, 3, 3);
  const offeredBefore = messages.filter((m) => m.meta?.techniqueOffered).map((m) => m.meta!.techniqueOffered!);
  const fresh = hits.find((h) => h.entry.technique && !s.givenTechniques.includes(h.entry.slug) && !offeredBefore.includes(h.entry.slug));
  const positive = f.sentiment > 0.5 && f.concerns.length === 0;
  const sources = hits.slice(0, 2).map((h) => ({ slug: h.entry.slug, title: h.entry.title }));
  const prevAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const prevMeta = prevAssistant?.meta;
  const justOffered = !!prevMeta?.techniqueOffered;
  const recentMeta = messages.slice(-5).map((m) => m.meta?.questionId ?? "");
  const recentNews = !!f.hardNews || recentMeta.some((id) => id.startsWith("sup_news_"));
  const recentlyDeclined = recentMeta.includes("sup_after_decline");
  const userMsgs = messages.filter((m) => m.role === "user");
  const said = messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n");
  const insightOf = (slug: string) => {
    const insight = getEntry(slug)?.insight ?? "";
    return said.includes(insight) ? "" : insight;
  };
  const followup = (text: string, questionId: string, extra: Partial<MessageMeta> = {}): EngineReply => ({
    text,
    meta: { ...base, topic: "support_followup", questionId, ...extra },
  });
  const nextQuestion = (offset: number) => {
    const q = pickNextQuestion(s);
    const rotate = q?.repeatable ? messages.filter((m) => m.meta?.questionId === q.id).length : undefined;
    return { q, ask: q ? questionText(q, s, seed + offset, recent, rotate) : "" };
  };

  // Explicit request for a technique: the one they named, the one just offered, something calming, or one that fits.
  const answeringTips = prevMeta?.questionId === "sup_tips_topic" && !f.negative && !f.skip;
  if ((f.wantsTechnique || answeringTips) && !(f.hardNews && !f.techniqueRequest)) {
    const notGiven = (slug: string) => !s.givenTechniques.includes(slug);
    const named = f.techniqueRequest ? getEntry(f.techniqueRequest) : undefined;
    if (named?.technique) return guideTechnique(named, mode, base, mode === "voice" ? "Of course, let's do it together." : "Of course — let's go through it together.");
    const fits = (list: RetrievalHit[]) => list.find((h) => h.entry.technique && notGiven(h.entry.slug))?.entry;
    const calming = CALMING.test(lastText) ? getEntry(CALMING_ORDER.find(notGiven) ?? CALMING_ORDER[0]) : undefined;
    const requested =
      (s.pendingTechnique ? getEntry(s.pendingTechnique) : undefined) ??
      calming ??
      fits(answeringTips ? retrieveKnowledge(lastText, 3, 3) : hits) ??
      fits(s.memory.concerns.length ? retrieveKnowledge(s.memory.concerns.join(" "), 3, 3) : []) ??
      // Asked twice without anything specific: a gentle, general default.
      (answeringTips ? getEntry(CALMING_ORDER.find(notGiven) ?? CALMING_ORDER[0]) : undefined);
    if (requested?.technique) {
      const e = requested;
      return {
        text:
          mode === "voice"
            ? `${pick(["Of course.", "Sure, here's one idea."], seed)} ${e.technique!.voiceScript} Does that feel like something you could try?`
            : `${pick(["Of course — here's one idea that helps a lot of people.", "Sure. Here's something many people find useful."], seed)} ${insightOf(e.slug)}`.trim() +
              `\n\n${techniqueText(e.slug, mode)}\n\nDoes that feel like something you could try?`,
        meta: { ...base, topic: "technique", questionId: `tech_${e.slug}`, techniqueGiven: e.slug, sources: [{ slug: e.slug, title: e.title }] },
      };
    }
    return followup(
      pick(
        [
          "Happy to share some ideas. What would you like a hand with — stress, sleep, worry, or something else?",
          "Of course. So I can pick something that fits, what's been trickiest lately — stress, sleep, worry, or something else?",
        ],
        seed,
      ),
      "sup_tips_topic",
    );
  }

  // Big news: care first, no exercises.
  if (f.hardNews) {
    const repeat = recentMeta.includes(`sup_news_${f.hardNews}`);
    if (!repeat) {
      const grief = f.hardNews === "loss" || f.hardNews === "breakup" ? getEntry("grief-and-loss") : undefined;
      return followup(hardNewsReply(f.hardNews, lastText, seed), `sup_news_${f.hardNews}`, grief ? { sources: [{ slug: grief.slug, title: grief.title }] } : {});
    }
  }

  // "I'd just like to vent" → listen, without steering.
  if (f.wantsToVent) {
    return followup(
      pick(
        ["Of course. Go ahead — I'm listening, and it doesn't have to come out neat or tidy.", "Absolutely. This is your space — say whatever you need to, and I'll just listen."],
        seed,
      ),
      "sup_vent",
    );
  }

  // "Talk about it, or take your mind off it?" → "talk" / "yes", or "anything else you'd like to talk about?" → "yes".
  const askedToTalk = /\b(would you like to talk|anything else you'?d like to talk about|want to talk about it)\b/i.test(prevAssistant?.content ?? "");
  if ((s.lastTopic === "stress" || askedToTalk) && !f.negative && f.concerns.length === 0 && (f.affirmative || CHOOSE_TALK.test(lastText))) {
    return followup(pick(["Of course — I'm listening. What's been going on?", "I'm here. Tell me what happened, in whatever way feels easiest."], seed), "sup_invite");
  }

  // They asked to talk about something specific: acknowledge it directly.
  if (f.topicRequest) {
    const explicit = EXPLICIT_TALK.test(lastText);
    if (f.concerns.length > 0 && f.sentiment < 0 && (supportTurns === 0 || explicit)) {
      const { q, ask } = nextQuestion(0);
      const opener = ASKED.test(lastText) ? `${pick(["Of course, let's talk about it.", "Absolutely — I'm glad you brought it up."], seed)} ` : "";
      return {
        text: `${opener}${CONCERN_EMPATHY[f.concerns[0]] ?? reflect(s, seed + 1, "chat")} ${ask}`.trim(),
        meta: { ...base, topic: q?.topic, questionId: q?.id },
      };
    }
    if (explicit) {
      const topic = topicEcho(lastText);
      return followup(
        topic ? `Of course — let's talk about ${topic}. ${pick(["Where would you like to start?", "What's been going on?"], seed)}` : "Of course — I'm all ears. What's on your mind?",
        "sup_invite",
      );
    }
  }

  // Feedback on a technique just shared (checked before anything upbeat, and never followed by another offer).
  if (prevMeta?.techniqueGiven) {
    let text: string;
    if (prevMeta.topic === "technique") {
      // We asked "could you try it?"
      text = f.negative
        ? "That's okay — not every idea fits everyone. What do you feel you need most right now?"
        : f.affirmative
          ? "Great — go gently with it and notice how it feels. What else is on your mind?"
          : "Thanks for telling me. What else is on your mind?";
    } else {
      // We asked "how do you feel afterwards?"
      const library = mode === "chat" ? " — it's in the Library too" : "";
      const feedback = techniqueFeedback(f, lastText);
      text =
        feedback === "better"
          ? `${pick(["I'm really glad that helped a little.", "That's great — even a small shift counts."], seed)} You can come back to it any time${library}. What would feel helpful to talk about next?`
          : feedback === "mixed"
            ? `Even a small shift counts — and it's okay that some of it is still there. You can come back to it any time${library}. What would feel helpful to talk about next?`
            : feedback === "worse"
              ? "That's okay — not every technique clicks every time, and that's useful to know. What do you feel you need most right now?"
              : "Thanks for giving it a go. Sometimes the effect is subtle at first, and that's okay. What do you feel you need most right now?";
    }
    return followup(text, `after_tech_${supportTurns}`);
  }

  // Positive conversation: savour it.
  if (positive) {
    const gratitude = getEntry("gratitude-savoring")!;
    const offer = supportTurns >= 3 && !justOffered && !recentNews && !s.givenTechniques.includes(gratitude.slug) && !offeredBefore.includes(gratitude.slug);
    if (offer) {
      return {
        text: `${pick(["That's really lovely to hear.", "I'm so glad."], seed)} ${gratitude.insight} Would you like a quick idea for holding on to good moments like this?`,
        meta: { ...base, topic: "technique", techniqueOffered: gratitude.slug, sources: [{ slug: gratitude.slug, title: gratitude.title }] },
      };
    }
    const { q, ask } = nextQuestion(3);
    return {
      text: [acknowledge(s, seed, mode, lastText), ask].filter(Boolean).join(" "),
      meta: { ...base, topic: ask ? q?.topic : undefined, questionId: ask ? q?.id : undefined },
    };
  }

  // Difficult feelings or a specific topic.
  const reflection =
    f.sentiment < 0 || f.concerns.length > 0
      ? reflect(s, seed, mode)
      : recentNews
        ? pick(["Thank you for telling me a bit more.", "Thank you for sharing that with me."], seed)
        : acknowledge(s, seed, mode, lastText) || pick(["Thank you for sharing that.", "I hear you.", "That makes sense."], seed);
  const presence = () =>
    freshLine(["I'm listening — keep going if there's more.", "Take your time. I'm right here.", "That's a lot to hold. Say as much or as little as you like."], recent, seed) ?? "I'm here.";

  // Venting in the last few turns: keep listening, no questions or exercises.
  const venting = userMsgs.slice(-4, -1).some((m) => extractFacts(m.content).wantsToVent);
  if (venting) return followup(`${reflection} ${presence()}`, "sup_listen");

  // Quiet replies ("fine", "ok", "nothing much"): don't keep asking — leave the door open instead.
  let lowStreak = 0;
  for (const m of [...userMsgs].reverse()) {
    if (!LOW_CONTENT.test(m.content.trim())) break;
    lowStreak += 1;
  }
  const closedRecently = recentMeta.slice(-4).includes("sup_close");
  const doneTalking = askedToTalk && (f.negative || NOTHING_MUCH.test(lastText));
  if ((lowStreak >= 2 || doneTalking) && !closedRecently) {
    const close =
      freshLine(
        [
          "That's okay — we don't have to dig into anything right now. I'm here whenever something comes to mind, big or small.",
          "No pressure at all. Sometimes it's enough just to check in — I'm here if anything comes up.",
        ],
        recent,
        seed,
      ) ?? "That's okay. I'm here whenever you'd like to talk.";
    return { text: close, meta: { ...base, questionId: "sup_close" } };
  }

  // Share knowledge and offer a technique — only when something is actually difficult, never two offers in a row,
  // not straight after a decline, and not while they're sharing hard news.
  const prevUser = userMsgs.at(-2)?.content;
  const prevFacts = prevUser ? extractFacts(prevUser) : undefined;
  const difficulty = f.sentiment < 0 || f.concerns.length > 0 || (!!prevFacts && (prevFacts.sentiment < 0 || prevFacts.concerns.length > 0));
  // Explore before solving: proactive offers only once the plan says it is time (ask-permission is handled earlier).
  if (turnPlan.move === "ask-permission" && fresh && supportTurns >= 1 && offeredBefore.length < 2 && !justOffered && !recentlyDeclined && !recentNews && difficulty && seed % 3 !== 0) {
    const e = fresh.entry;
    const t = e.technique!;
    const about = /^\d/.test(t.duration) ? ` — it takes about ${t.duration.replace(/ (to plan|a day)$/, "")}` : "";
    return {
      text: `${reflection} ${insightOf(e.slug)} ${pick(
        [
          `There's a short exercise${mode === "voice" ? "" : ` called "${t.name}"`} that can help${about}. Would you like to try it together?`,
          `Would it help to try something small for it together? I could walk you through a short exercise.`,
        ],
        seed,
      )}`,
      meta: { ...base, topic: "technique", questionId: `offer_${e.slug}`, techniqueOffered: e.slug, sources },
    };
  }

  const { q, ask } = nextQuestion(11);
  const insightText = supportTurns >= 2 && hits[0] && mode === "chat" && seed % 2 === 0 && !recentNews ? insightOf(hits[0].entry.slug) : "";
  const insight = insightText ? ` ${insightText}` : "";
  return {
    text: `${reflection}${insight} ${ask || presence()}`.replace(/\s+/g, " ").trim(),
    meta: { ...base, topic: ask ? q?.topic : "support_followup", questionId: ask ? q?.id : "sup_listen", sources: insight ? sources.slice(0, 1) : undefined },
  };
}
