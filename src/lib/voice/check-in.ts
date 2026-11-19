import { inferTopic } from "../agent/extract";
import { pickNextQuestion } from "../agent/questions";
import { analyzeConversation } from "../agent/state";
import type { ChatMessage, MessageMeta } from "../types";

/** How many check-ins Ari makes in a row before waiting quietly. */
export const MAX_CHECK_INS = 2;

export interface CheckIn {
  text: string;
  meta: MessageMeta;
}

/**
 * What Ari says when the user has been quiet in a voice session.
 * 1st check-in: in light conversation, reassurance plus an easy question from the conversation
 *   flow (never the question Ari just asked); in a hard conversation, a quiet "no rush" with no question.
 * 2nd check-in: a gentle "I'm here whenever you're ready", no question.
 * After a crisis or distress: a safety check-in with crisis lines instead of small talk.
 * Runs on-device: no AI call, so it costs nothing and works offline.
 */
export function checkInMessage(messages: ChatMessage[], count: number, crisis: boolean): CheckIn {
  const base: MessageMeta = { provider: "demo", via: "voice", nudge: true };
  if (crisis) {
    return {
      text:
        count <= 1
          ? "I'm still here with you, and there's no rush. If you need someone right now, you can call or text 988 in the US or Canada, or call Samaritans on 116 123 in the UK. Are you safe at the moment?"
          : "I'm right here whenever you want to talk. If you're in danger, please call your local emergency number.",
      meta: { ...base, stage: "support", safety: "distress", topic: count <= 1 ? "safety_check" : undefined },
    };
  }
  if (count > 1) {
    return {
      text: "No pressure at all. I'm here whenever you're ready, and you can also tap Type instead if that's easier.",
      meta: { ...base },
    };
  }

  const state = analyzeConversation(messages);
  const lastAri = [...messages].reverse().find((m) => m.role === "assistant");
  // In a hard conversation, silence often means thinking or feeling: offer space, not another question
  // (counselling research: hold space after heavy disclosures; never "are you still there?").
  const reflective = ["reflect-explore", "reflect-only", "comfort", "summarize", "ask-permission", "repair"];
  if (state.userLed || (lastAri?.meta?.strategy && reflective.includes(lastAri.meta.strategy))) {
    return {
      text: "No rush — take whatever time you need. I'm here when you want to carry on.",
      meta: { ...base, stage: "support", strategy: "reflect-only" },
    };
  }
  const justAsked = lastAri ? (lastAri.meta?.topic ?? inferTopic(lastAri.content)) : undefined;
  // Treat the question Ari just asked as answered, so the check-in offers something different and easier.
  if (justAsked && !state.answered.includes(justAsked)) state.answered.push(justAsked);
  if (lastAri?.meta?.questionId) state.askedQuestionIds.push(lastAri.meta.questionId);
  const next = pickNextQuestion(state);
  const opener = justAsked ? "Take your time, there's no rush. Or here's an easier one:" : "Take your time, there's no rush.";
  const question = next?.ask(state)[0] ?? "What's been on your mind today?";
  return {
    text: `${opener} ${question}`,
    meta: { ...base, stage: next?.stage ?? state.stage, topic: next?.topic, questionId: next?.id },
  };
}
