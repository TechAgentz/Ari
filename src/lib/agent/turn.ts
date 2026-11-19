import { getEntry } from "../knowledge/base";
import { retrieveKnowledge, type RetrievalHit } from "../knowledge/retrieve";
import { redactPII } from "../privacy/redact";
import { assessTurnRisk, crisisFlags, WITHHELD, type RiskAssessment } from "../safety/crisis";
import type { ChatMessage, ConversationState, SourceRef, StageId } from "../types";
import { buildSystemPrompt } from "./prompt";
import { planTurn, usedQuestionKinds } from "./strategy";
import { toChatMessages, type ChatRequestBody } from "./protocol";
import { analyzeConversation } from "./state";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PreparedTurn {
  /** Conversational plan for this reply (set by the strategy engine). */
  strategy?: { move: string; directive: string };
  /** Redacted history as ChatMessages, crisis disclosures withheld (for the scripted engine). */
  chatMessages: ChatMessage[];
  state: ConversationState;
  /** Risk of the latest message in context: a "yes" to a safety check is a crisis too. */
  risk: RiskAssessment;
  hits: RetrievalHit[];
  /** A crisis came up earlier in the window (re-screened, so it doesn't rely on meta). */
  priorCrisis: boolean;
  /** Library entries to cite under the reply (support stage, confident matches only). */
  sources?: SourceRef[];
  system: string;
  /** System prompt + recent history, ready for the AI provider. */
  providerMessages: ProviderMessage[];
}

const union = <T,>(a: T[], b: T[]) => [...new Set([...a, ...b])];
const STAGE_ORDER: StageId[] = ["intro", "social", "lifestyle", "wellbeing", "support"];

/** Combine what the server can infer from the recent window with the client's (non-personal) progress. */
export function mergeState(local: ConversationState, body: ChatRequestBody): ConversationState {
  const p = body.progress;
  const counts = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, Math.max(local.stageQuestionCounts[s], p.stageQuestionCounts[s] ?? 0)]),
  ) as Record<StageId, number>;
  return {
    ...local,
    answered: union(local.answered, p.answered),
    skipped: union(local.skipped, p.skipped),
    askedQuestionIds: union(local.askedQuestionIds, p.askedQuestionIds),
    givenTechniques: union(local.givenTechniques, p.givenTechniques),
    stageQuestionCounts: counts,
    userTurns: Math.max(local.userTurns, p.userTurns),
    userLed: local.userLed || p.userLed,
    stage: STAGE_ORDER[Math.max(STAGE_ORDER.indexOf(local.stage), STAGE_ORDER.indexOf(p.stage))],
  };
}

/**
 * Everything needed to answer one turn: redaction, conversation analysis,
 * risk screening, knowledge retrieval and the system prompt. Shared by the
 * /api/chat route and the prompt evaluation script so both use the same path.
 */
export function prepareTurn(body: ChatRequestBody, opts: { examples?: boolean } = {}): PreparedTurn {
  const redacted = body.messages.map((m) => ({ ...m, content: redactPII(m.content) }));
  // Crisis disclosures never reach the AI provider, on this turn or any later one. The whole
  // window is re-screened (meta can be missing), and those messages, the crisis replies and
  // risky answers to a safety check are replaced with neutral placeholders.
  const withheld = crisisFlags(redacted);
  const messages = redacted.map((m, i) => (withheld[i] ? { ...m, content: WITHHELD[m.role] } : m));
  const risk = assessTurnRisk(redacted);
  const priorCrisis = withheld.slice(0, -1).some(Boolean);
  const chatMessages = toChatMessages(messages);
  const local = analyzeConversation(chatMessages, body.shareContext ? body.memory : undefined);
  const merged = mergeState(local, body);
  // After a crisis the conversation stays supportive, even when the crisis reply's meta is missing.
  const state: ConversationState = priorCrisis ? { ...merged, userLed: true, stage: "support" } : merged;
  const lastUser = messages[messages.length - 1]?.content ?? "";
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join(" ");
  // A short reply ("yes, let's try") refers to what Ari just said, so search that too.
  const prevAssistant = [...messages.slice(0, -1)].reverse().find((m) => m.role === "assistant");
  const shortReply = lastUser.trim().split(/\s+/).length <= 8;
  let hits = retrieveKnowledge(shortReply && prevAssistant ? `${recentUser} ${prevAssistant.content}` : recentUser, 3, 3);
  // An exercise that was explicitly offered always comes first.
  // An exercise that was offered, or one the user asked for by name, comes first.
  const offered = getEntry(state.pendingTechnique ?? state.lastFacts?.techniqueRequest ?? "");
  if (offered) hits = [{ entry: offered, score: 99 }, ...hits.filter((h) => h.entry.slug !== offered.slug)].slice(0, 3);
  const strategy = planTurn(chatMessages, state, risk.level, priorCrisis);
  const system = buildSystemPrompt({
    plan: strategy,
    avoidKinds: usedQuestionKinds(chatMessages),
    state,
    mode: body.mode,
    knowledge: hits,
    shareContext: body.shareContext,
    safety: risk.level,
    priorCrisis,
    examples: opts.examples,
  });
  const sources = state.stage === "support" && hits[0] && hits[0].score >= 4 ? hits.slice(0, 2).map((h) => ({ slug: h.entry.slug, title: h.entry.title })) : undefined;
  return {
    chatMessages,
    state,
    risk,
    hits,
    priorCrisis,
    sources,
    system,
    strategy: { move: strategy.move, directive: strategy.directive },
    providerMessages: [{ role: "system", content: system }, ...messages.map((m): ProviderMessage => ({ role: m.role, content: m.content }))],
  };
}
