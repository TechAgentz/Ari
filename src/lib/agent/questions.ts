import type { ConversationState, StageId, TopicId } from "../types";

/**
 * Question bank for the conversational flow. These are never asked as a
 * checklist: the engine picks at most one per reply, skips anything already
 * answered or declined, and abandons the plan when the user leads.
 */
export interface Question {
  id: string;
  stage: StageId;
  topic: TopicId;
  /** Description used as a hint for the LLM. */
  hint: string;
  ask: (s: ConversationState) => string[];
  when?: (s: ConversationState) => boolean;
  /** Can be asked again later (open-ended support follow-ups). */
  repeatable?: boolean;
}

const has = (s: ConversationState, t: TopicId) => s.answered.includes(t) || s.skipped.includes(t);
const livesWithOthers = (s: ConversationState) =>
  !!s.memory.household && ["family", "partner", "friends", "roommates"].includes(s.memory.household.kind);
const negativeLately = (s: ConversationState) =>
  s.memory.dayMood === "negative" || (s.lastFacts?.sentiment ?? 0) < 0 || s.memory.feelings.length > 0 || s.memory.concerns.length > 0;

export const QUESTIONS: Question[] = [
  // Stage 1 — friendly introduction
  {
    id: "intro_day",
    stage: "intro",
    topic: "day",
    hint: "how their day is going",
    ask: () => ["How's your day going so far?", "How has today been treating you?"],
  },
  {
    id: "intro_rough_choice",
    stage: "intro",
    topic: "stress",
    hint: "whether they'd like to talk about what made the day hard, or take their mind off it",
    when: (s) => s.memory.dayMood === "negative",
    ask: () => [
      "Would you like to talk about what made it tough, or would you rather take your mind off it and just chat for a bit?",
    ],
  },
  {
    id: "intro_name",
    stage: "intro",
    topic: "name",
    hint: "what name they'd like to be called (optional)",
    when: (s) => !s.memory.name,
    ask: () => [
      "By the way, what would you like me to call you? Totally fine to skip that one.",
      "What should I call you, if you'd like to share a name? No pressure at all.",
    ],
  },

  // Stage 2 — family and social environment
  {
    id: "social_household",
    stage: "social",
    topic: "household",
    hint: "who they live with — family, friends, or on their own (optional, easy to skip)",
    ask: () => [
      "Can I ask who's at home with you these days — do you live with family, friends, or on your own? Only if you feel like sharing.",
      "I'd love to get a sense of your world. Do you live with others, or have your own place? Feel free to skip this.",
    ],
  },
  {
    id: "social_size",
    stage: "social",
    topic: "household_size",
    hint: "how many people are in their household (only if comfortable)",
    when: (s) => !!s.memory.household && ["family", "friends", "roommates"].includes(s.memory.household.kind) && !s.memory.householdSize,
    ask: () => ["How many of you are under one roof, if you don't mind me asking?"],
  },
  {
    id: "social_together",
    stage: "social",
    topic: "together",
    hint: "what they enjoy doing together with the people they live with",
    when: (s) => livesWithOthers(s),
    ask: (s) =>
      s.memory.household?.kind === "partner"
        ? ["What do you two enjoy doing together when you get the chance?"]
        : ["What do you all enjoy doing together when you get the chance?", "Is there something you like doing together at home?"],
  },
  {
    id: "social_alone",
    stage: "social",
    topic: "together",
    hint: "what they enjoy about having their own space",
    when: (s) => s.memory.household?.kind === "alone" || s.memory.household?.kind === "pets",
    ask: (s) =>
      s.memory.household?.kind === "pets"
        ? ["What's life like with your furry housemate?"]
        : ["What do you enjoy most about having your own space?"],
  },
  {
    id: "social_support",
    stage: "social",
    topic: "support_network",
    hint: "who they usually turn to when they want to talk something through",
    ask: () => [
      "When you want to talk something through, who do you usually turn to? It could be anyone — a friend, a sibling, even a pet.",
    ],
  },

  // Stage 3 — daily lifestyle
  {
    id: "life_occupation",
    stage: "lifestyle",
    topic: "occupation",
    hint: "what fills their days — work, studies, or something else",
    ask: () => [
      "What fills most of your days at the moment — work, studies, something else?",
      "What keeps you busy day to day — are you working, studying, or something else entirely?",
    ],
  },
  {
    id: "life_occ_detail",
    stage: "lifestyle",
    topic: "occupation_detail",
    hint: "what they enjoy (or find hardest) about their work or studies",
    when: (s) => !!s.memory.occupation,
    ask: (s) =>
      s.memory.occupation?.kind === "study"
        ? ["What do you enjoy most about what you're studying?"]
        : s.memory.occupation?.kind === "work"
          ? ["What's the part of your work you enjoy most?", "How do you find the work itself — what do you like about it?"]
          : ["How are you finding that at the moment?"],
  },
  {
    id: "life_routine",
    stage: "lifestyle",
    topic: "routine",
    hint: "what a typical day looks like",
    ask: () => ["What does a typical day look like for you, roughly?"],
  },
  {
    id: "life_free_time",
    stage: "lifestyle",
    topic: "free_time",
    hint: "what they like to do in their free time",
    when: (s) => s.memory.interests.length === 0,
    ask: () => ["When you get some free time, what do you like to do?", "What do you like doing to unwind?"],
  },
  {
    id: "life_interest_follow",
    stage: "lifestyle",
    topic: "free_time",
    hint: "a follow-up about one of the interests they mentioned",
    when: (s) => s.memory.interests.length > 0,
    ask: (s) => [`How did you get into ${s.memory.interests[0]}?`, `What do you enjoy most about ${s.memory.interests[0]}?`],
  },

  // Stage 4 — emotional wellbeing
  {
    id: "well_feelings",
    stage: "wellbeing",
    topic: "feelings",
    hint: "gently, how they've been feeling overall lately",
    ask: (s) => [
      s.memory.occupation
        ? "With everything you've got going on, how have you been feeling overall these last couple of weeks?"
        : "Thinking about the last couple of weeks, how have you been feeling overall?",
    ],
  },
  {
    id: "well_energy",
    stage: "wellbeing",
    topic: "energy_sleep",
    hint: "how their energy and sleep have been",
    ask: () => ["How have your energy and sleep been lately?"],
  },
  {
    id: "well_stress",
    stage: "wellbeing",
    topic: "stress",
    hint: "whether anything has been weighing on them (only if context invites it)",
    when: (s) => negativeLately(s),
    ask: () => ["Has anything been weighing on you lately? No pressure if not."],
  },
  {
    id: "well_positive",
    stage: "wellbeing",
    topic: "positive",
    hint: "something that has gone well recently",
    when: (s) => !negativeLately(s),
    ask: () => ["What's something that's gone well for you recently, even something small?"],
  },

  // Stage 5 — supportive conversation (open-ended, repeatable)
  {
    id: "sup_hardest",
    stage: "support",
    topic: "support_followup",
    hint: "what has been the hardest part of what they raised",
    when: (s) => s.memory.concerns.length > 0,
    ask: () => ["What's been the hardest part of it for you?", "What part of it has been weighing on you the most?"],
  },
  {
    id: "sup_explore",
    stage: "support",
    topic: "support_followup",
    hint: "what has been making things feel heavier lately",
    repeatable: false,
    when: (s) => negativeLately(s),
    ask: () => ["What do you think has been making it feel heavier lately?", "When did you first notice things feeling this way?"],
  },
  {
    id: "sup_helped_before",
    stage: "support",
    topic: "support_followup",
    hint: "what has helped them before, even a little",
    when: (s) => negativeLately(s),
    ask: () => ["When things have felt like this before, what's helped, even a little?"],
  },
  {
    id: "sup_interest_link",
    stage: "support",
    topic: "support_followup",
    hint: "whether they've had time for something they enjoy",
    when: (s) => negativeLately(s) && s.memory.interests.length > 0,
    ask: (s) => [`Have you had much time for ${s.memory.interests[0]} lately?`],
  },
  {
    id: "sup_people",
    stage: "support",
    topic: "support_followup",
    hint: "whether someone in their life knows how they've been feeling",
    // Not after a decline, and not when they told us they have no one to turn to.
    when: (s) =>
      negativeLately(s) &&
      !s.skipped.includes("household") &&
      !s.skipped.includes("support_network") &&
      !(s.answered.includes("support_network") && !s.memory.supportPeople),
    ask: (s) =>
      s.memory.supportPeople
        ? [`You mentioned ${s.memory.supportPeople.replace(/^(my|probably|usually)\s+/i, "your ")} earlier — do they know how you've been feeling?`]
        : ["Is there someone in your life who knows how you've been feeling?"],
  },
  {
    id: "sup_small_win",
    stage: "support",
    topic: "support_followup",
    hint: "what a small win would look like this week",
    ask: () => ["What would a small win look like for you this week?"],
  },
  {
    id: "sup_positive_source",
    stage: "support",
    topic: "positive",
    hint: "what has been helping them feel good",
    // Only after they've said something positive.
    when: (s) => !negativeLately(s) && (s.lastFacts?.sentiment ?? 0) > 0.5,
    ask: () => ["What do you think has been helping you feel this way?"],
  },
  {
    id: "sup_looking_forward",
    stage: "support",
    topic: "positive",
    hint: "something they are looking forward to",
    when: (s) => !negativeLately(s),
    ask: () => ["Is there anything coming up that you're looking forward to?"],
  },
  {
    id: "sup_open",
    stage: "support",
    topic: "support_followup",
    hint: "what's on their mind right now",
    repeatable: true,
    ask: () => ["What's on your mind right now?", "Is there anything else you'd like to talk about?", "How are you feeling about it all right now?"],
  },
];

const STAGE_ORDER: StageId[] = ["intro", "social", "lifestyle", "wellbeing", "support"];

/** Pick the next question: current stage first, then later stages. Never repeats or revisits skipped topics. */
export function pickNextQuestion(s: ConversationState): Question | undefined {
  const start = STAGE_ORDER.indexOf(s.stage);
  for (const stage of STAGE_ORDER.slice(start)) {
    if (stage === "social" && s.skipped.includes("household") && s.stage !== "social") continue;
    for (const q of QUESTIONS) {
      if (q.stage !== stage) continue;
      if (!q.repeatable && s.askedQuestionIds.includes(q.id)) continue;
      if (s.skipped.includes(q.topic)) continue;
      if (!q.repeatable && has(s, q.topic) && q.topic !== "support_followup" && q.topic !== "positive") continue;
      if (q.when && !q.when(s)) continue;
      if (stage === "social" && s.skipped.includes("household")) continue;
      return q;
    }
  }
  return QUESTIONS.find((q) => q.id === "sup_open");
}
