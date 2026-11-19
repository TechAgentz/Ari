import type { ChatMessage, ConversationState, Memory, StageId, TopicId } from "../types";
import { extractFacts, inferTopic } from "./extract";

export const emptyMemory = (): Memory => ({ interests: [], feelings: [], concerns: [] });

const SOCIAL_TOPICS: TopicId[] = ["household", "household_size", "together", "support_network"];
/** Getting-to-know-you questions. A reply that changes the subject (a question, a request, big news) doesn't answer them. */
const PROFILE_TOPICS: TopicId[] = [...SOCIAL_TOPICS, "name", "occupation", "occupation_detail", "routine", "free_time"];
/** Declining "talk about it, or take your mind off it?". */
const DECLINE_STRESS =
  /\b(mind off|just chat|chat for a bit|distract|something else|talk about something (else|different|fun|lighter|nice|happier)|not now|not really|rather not|keep (it|things) light|lighter)\b|^(let'?s |just )?chat\b/i;
/** "Nothing much", "all good": nothing is weighing on them. */
const NOTHING_WRONG =
  /^(nothing|not much|not a lot|no|nope|nah|all good|(i'?m|it'?s|everything'?s|all) (fine|good|ok(ay)?|alright|great)|not (at the moment|right now|today|really))\b/i;
/** "We don't do anything together anymore": not something to remember as a shared activity. */
const EMPTY_TOGETHER = /\b(anymore|any more|(don'?t|do not|never|hardly|rarely) (really |ever |even )?(do|get|have|go|see))\b/i;
/** Choosing to talk about it: "talk", "I'd rather talk", "talking would help". */
const CHOOSE_TALK = /\b(talk|talking|vent|venting|tell you|let it out|off my chest|first one|the first)\b/i;
/** Everyday words that alone shouldn't redirect the conversation. */
const MILD_EMOTIONS = new Set(["hard", "tough", "difficult", "rough", "bad", "busy", "meh", "blah", "bored", "tired", "down", "low", "lost", "sick"]);

function pushUnique<T>(arr: T[], ...items: T[]) {
  for (const item of items) if (!arr.includes(item)) arr.push(item);
}

/**
 * Derives the conversation state (stage, remembered facts, answered and
 * skipped topics) from the message history. Pure and deterministic, so it
 * runs identically on the client and on the server.
 */
export function analyzeConversation(messages: ChatMessage[], seedMemory?: Memory): ConversationState {
  const state: ConversationState = {
    stage: "intro",
    memory: seedMemory ? structuredClone(seedMemory) : emptyMemory(),
    answered: [],
    skipped: [],
    askedQuestionIds: [],
    stageQuestionCounts: { intro: 0, social: 0, lifestyle: 0, wellbeing: 0, support: 0 },
    userTurns: 0,
    givenTechniques: [],
    userLed: false,
  };
  if (seedMemory?.name) pushUnique(state.answered, "name");

  let lastTopic: TopicId | undefined;
  let lastOffered: string | undefined;
  let lastQuestionId: string | undefined;

  messages.forEach((msg, index) => {
    if (msg.role === "assistant") {
      const topic = msg.meta?.topic ?? inferTopic(msg.content);
      lastTopic = topic;
      lastOffered = msg.meta?.techniqueOffered;
      lastQuestionId = msg.meta?.questionId;
      if (msg.meta?.questionId) pushUnique(state.askedQuestionIds, msg.meta.questionId);
      if (topic) {
        const stage: StageId = msg.meta?.stage ?? state.stage;
        state.stageQuestionCounts[stage] += 1;
      }
      if (msg.meta?.techniqueGiven) pushUnique(state.givenTechniques, msg.meta.techniqueGiven);
      // After a crisis reply, or once an exercise is offered or given, the conversation stays supportive.
      if (msg.meta?.safety === "crisis" || msg.meta?.techniqueOffered || msg.meta?.techniqueGiven) state.userLed = true;
      return;
    }

    // User message
    state.userTurns += 1;
    const facts = extractFacts(msg.content, lastTopic);
    const m = state.memory;
    const isLast = index === messages.length - 1;
    const text = msg.content.trim();

    const declinedStress = lastTopic === "stress" && (DECLINE_STRESS.test(text) || (lastQuestionId === "intro_rough_choice" && facts.negative));
    // Questions, requests and big news change the subject: they neither answer nor decline a profile question.
    const redirect =
      facts.asksIfAI ||
      facts.asksDiagnosis ||
      (!!lastTopic && PROFILE_TOPICS.includes(lastTopic) && (facts.topicRequest || facts.wantsTechnique || !!facts.wantsToVent || !!facts.hardNews));

    if ((facts.skip || declinedStress) && lastTopic) {
      pushUnique(state.skipped, lastTopic);
      // Declining any family or relationship question drops all of them.
      if (SOCIAL_TOPICS.includes(lastTopic)) pushUnique(state.skipped, ...SOCIAL_TOPICS);
    } else if (lastTopic && !redirect) {
      pushUnique(state.answered, lastTopic);
    }

    if (facts.name && !m.name && !facts.skip) {
      m.name = facts.name;
      pushUnique(state.answered, "name");
    }
    if (facts.household && !facts.skip) {
      m.household = facts.household;
      pushUnique(state.answered, "household");
    }
    if (facts.householdSize && !facts.skip) {
      m.householdSize = facts.householdSize;
      pushUnique(state.answered, "household_size");
    }
    if (facts.occupation && !facts.skip) {
      m.occupation = facts.occupation;
      pushUnique(state.answered, "occupation");
    }
    if (facts.interests.length) {
      for (const i of facts.interests) if (!m.interests.includes(i)) m.interests.push(i);
      m.interests = m.interests.slice(-6);
      pushUnique(state.answered, "free_time");
    }
    if (!facts.skip && !redirect && !/\?$/.test(text)) {
      const snippet = text.replace(/\s+/g, " ").slice(0, 80);
      // Only remember what they enjoy together when it is something they enjoy, and only people they named.
      if (lastTopic === "together" && facts.sentiment >= 0 && !facts.negative && !NOTHING_WRONG.test(text) && !EMPTY_TOGETHER.test(text)) m.together = snippet;
      if (lastTopic === "support_network" && facts.supportPerson) m.supportPeople = facts.supportPerson;
      if (lastTopic === "routine") m.routine = snippet;
    }
    if (lastTopic === "day" || state.userTurns === 1) {
      if (!facts.asksIfAI && !facts.asksDiagnosis) m.dayMood = facts.sentiment > 0.5 ? "positive" : facts.sentiment < -0.3 ? "negative" : "neutral";
      pushUnique(state.answered, "day");
    }
    if (facts.emotions.length) {
      m.feelings = [...m.feelings.filter((f) => !facts.emotions.includes(f)), ...facts.emotions].slice(-6);
      if (lastTopic === "feelings" || lastTopic === "stress" || lastTopic === "energy_sleep") pushUnique(state.answered, "feelings");
    }
    if (facts.concerns.length) {
      m.concerns = [...m.concerns.filter((c) => !facts.concerns.includes(c)), ...facts.concerns].slice(-4);
    }

    // Follow the user's lead the moment they bring up something specific or difficult.
    // A rough day on its own gets a gentle "talk about it or take your mind off it?" choice first.
    const answeringDay = lastTopic === "day" || state.userTurns === 1;
    const strongEmotion = facts.emotions.some((e) => !MILD_EMOTIONS.has(e) && !e.startsWith("not "));
    // "Talk about it, or take your mind off it?" (or "anything weighing on you?"): anything but a decline means talking.
    const choseTalk =
      lastTopic === "stress" &&
      !facts.skip &&
      !declinedStress &&
      !facts.negative &&
      !NOTHING_WRONG.test(text) &&
      (facts.sentiment < 0 ||
        facts.concerns.length > 0 ||
        facts.affirmative ||
        CHOOSE_TALK.test(text) ||
        (lastQuestionId === "intro_rough_choice" && facts.sentiment <= 0.5) ||
        (text.split(/\s+/).length >= 2 && facts.sentiment <= 0));
    const leans =
      facts.topicRequest ||
      facts.asksDiagnosis ||
      facts.wantsTechnique ||
      !!facts.wantsToVent ||
      // Bereavement, a breakup, illness or tears get care straight away, on any turn.
      !!facts.hardNews ||
      // A rough first answer gets the "talk about it or take your mind off it?" choice instead.
      (!answeringDay && facts.sentiment <= -2) ||
      (!answeringDay && facts.concerns.length > 0 && facts.sentiment < 0 && strongEmotion) ||
      choseTalk ||
      ((lastTopic === "feelings" || lastTopic === "energy_sleep") && facts.sentiment <= -1);
    if (leans) state.userLed = true;

    if (isLast) {
      state.lastFacts = facts;
      state.lastTopic = lastTopic;
      state.pendingTechnique = lastOffered;
    }
  });

  state.stage = computeStage(state);
  return state;
}

function computeStage(s: ConversationState): StageId {
  if (s.userLed) return "support";
  const done = (t: TopicId) => s.answered.includes(t) || s.skipped.includes(t);
  const c = s.stageQuestionCounts;

  const introDone = (done("day") && (done("name") || !!s.memory.name) && !(s.memory.dayMood === "negative" && !done("stress") && c.intro < 3)) || c.intro >= 3 || s.userTurns >= 4;
  if (!introDone) return "intro";

  const socialDone = s.skipped.includes("household") || (done("household") && c.social >= 2) || c.social >= 3;
  if (!socialDone) return "social";

  const lifeDone = (done("occupation") && (done("free_time") || done("routine")) && c.lifestyle >= 2) || c.lifestyle >= 3;
  if (!lifeDone) return "lifestyle";

  const wellDone = (done("feelings") && c.wellbeing >= 2) || c.wellbeing >= 2 || s.skipped.includes("feelings");
  if (!wellDone) return "wellbeing";

  return "support";
}

/** Minimal, human-readable summary of remembered context (sent only with consent). */
export function summarizeMemory(m: Memory): string {
  const parts: string[] = [];
  if (m.name) parts.push(`Preferred name: ${m.name}`);
  if (m.household) parts.push(`Home: ${m.household.detail}${m.householdSize ? ` (${m.householdSize} people)` : ""}`);
  if (m.together) parts.push(`Enjoys with household: ${m.together}`);
  if (m.supportPeople) parts.push(`Turns to: ${m.supportPeople}`);
  if (m.occupation) parts.push(`Days: ${m.occupation.detail}`);
  if (m.routine) parts.push(`Routine: ${m.routine}`);
  if (m.interests.length) parts.push(`Interests: ${m.interests.join(", ")}`);
  if (m.feelings.length) parts.push(`Feelings mentioned: ${m.feelings.join(", ")}`);
  if (m.concerns.length) parts.push(`Topics raised: ${m.concerns.join(", ")}`);
  return parts.join(". ");
}

/** Merge memory learned server-side from the recent window with consented client memory. */
export function mergeMemory(base: Memory, extra?: Partial<Memory>): Memory {
  if (!extra) return base;
  return {
    ...extra,
    ...Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))),
    interests: [...new Set([...(extra.interests ?? []), ...base.interests])].slice(-6),
    feelings: [...new Set([...(extra.feelings ?? []), ...base.feelings])].slice(-6),
    concerns: [...new Set([...(extra.concerns ?? []), ...base.concerns])].slice(-4),
  } as Memory;
}
