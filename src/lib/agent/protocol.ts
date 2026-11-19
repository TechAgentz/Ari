import { LIMITS } from "../config";
import { redactPII } from "../privacy/redact";
import { assessRisk } from "../safety/crisis";
import type { ChatMessage, ConversationState, Memory, MessageMeta, StageId, TopicId } from "../types";

/** Non-personal conversation progress the client shares so the server keeps the flow on track. */
export interface ConversationProgress {
  stage: StageId;
  answered: TopicId[];
  skipped: TopicId[];
  askedQuestionIds: string[];
  stageQuestionCounts: Record<StageId, number>;
  givenTechniques: string[];
  userTurns: number;
  userLed: boolean;
}

export interface ChatRequestBody {
  mode: "chat" | "voice";
  messages: { role: "user" | "assistant"; content: string; meta?: Pick<MessageMeta, "topic" | "questionId" | "stage" | "techniqueOffered" | "techniqueGiven" | "safety" | "strategy" | "nudge"> }[];
  progress: ConversationProgress;
  /** Only included when the user consented to sharing personal context. */
  memory?: Memory;
  shareContext: boolean;
}

const STAGES: StageId[] = ["intro", "social", "lifestyle", "wellbeing", "support"];
const TOPICS: TopicId[] = [
  "day", "name", "household", "household_size", "together", "support_network", "occupation", "occupation_detail",
  "routine", "free_time", "feelings", "energy_sleep", "stress", "positive", "support_followup", "technique", "safety_check",
];

export function progressFromState(s: ConversationState): ConversationProgress {
  return {
    stage: s.stage,
    answered: s.answered,
    skipped: s.skipped,
    askedQuestionIds: s.askedQuestionIds,
    stageQuestionCounts: s.stageQuestionCounts,
    givenTechniques: s.givenTechniques,
    userTurns: s.userTurns,
    userLed: s.userLed,
  };
}

/**
 * Remembered text gets the same redaction as messages, and anything that reads as a
 * crisis disclosure is dropped. Redaction runs before any shortening, so a cut can't
 * split a phone number or an email address past the rules.
 */
function cleanMemoryText(text: string): string | undefined {
  const clean = redactPII(text).replace(/\s+/g, " ").trim();
  return clean && assessRisk(clean).level !== "crisis" ? clean : undefined;
}

/** Redacts every remembered string (on the client before sending, and again on the server). */
export function sanitizeMemory<T extends Memory>(memory: T): T {
  const clean = (value: unknown): unknown => {
    if (typeof value === "string") return cleanMemoryText(value);
    if (Array.isArray(value)) return value.map(clean).filter((x) => x !== undefined);
    if (value && typeof value === "object") {
      const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
      // { kind, detail } without its detail says nothing useful.
      return "detail" in value && out.detail === undefined ? undefined : out;
    }
    return value;
  };
  return clean(memory) as T;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const strArr = (v: unknown, max = 40) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.slice(0, 80)) : []);
/** Memory text: capped generously, cleaned, then cut to its final length. */
const memText = (v: unknown, max: number) => (typeof v === "string" ? cleanMemoryText(v.slice(0, 1000))?.slice(0, max) : undefined);
const memList = (v: unknown, max: number) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .slice(0, max)
        .map((x) => memText(x, 80))
        .filter((x): x is string => !!x)
    : [];
const isStage = (v: unknown): v is StageId => typeof v === "string" && (STAGES as string[]).includes(v);
const topics = (v: unknown) => strArr(v).filter((t): t is TopicId => (TOPICS as string[]).includes(t));

/** Validates and sanitises an untrusted request body. Returns null if invalid. */
export function parseChatRequest(input: unknown): ChatRequestBody | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length === 0) return null;

  const messages: ChatRequestBody["messages"] = [];
  for (const raw of body.messages.slice(-LIMITS.contextWindow)) {
    if (!raw || typeof raw !== "object") return null;
    const m = raw as Record<string, unknown>;
    if (m.role !== "user" && m.role !== "assistant") return null;
    const content = str(m.content, LIMITS.maxMessageChars * 2);
    if (content === undefined) return null;
    const meta = (m.meta && typeof m.meta === "object" ? m.meta : {}) as Record<string, unknown>;
    messages.push({
      role: m.role,
      content,
      meta: {
        topic: topics([meta.topic])[0],
        questionId: str(meta.questionId, 60),
        stage: isStage(meta.stage) ? meta.stage : undefined,
        techniqueOffered: str(meta.techniqueOffered, 60),
        techniqueGiven: str(meta.techniqueGiven, 60),
        safety: meta.safety === "crisis" || meta.safety === "distress" ? meta.safety : undefined,
        strategy: typeof meta.strategy === "string" && /^[a-z-]{2,24}$/.test(meta.strategy) ? meta.strategy : undefined,
        nudge: meta.nudge === true ? true : undefined,
      },
    });
  }
  if (messages[messages.length - 1].role !== "user") return null;

  const p = (body.progress && typeof body.progress === "object" ? body.progress : {}) as Record<string, unknown>;
  const counts = (p.stageQuestionCounts && typeof p.stageQuestionCounts === "object" ? p.stageQuestionCounts : {}) as Record<string, unknown>;
  const progress: ConversationProgress = {
    stage: isStage(p.stage) ? p.stage : "intro",
    answered: topics(p.answered),
    skipped: topics(p.skipped),
    askedQuestionIds: strArr(p.askedQuestionIds, 80),
    stageQuestionCounts: Object.fromEntries(STAGES.map((s) => [s, Math.max(0, Math.min(99, Number(counts[s]) || 0))])) as Record<StageId, number>,
    givenTechniques: strArr(p.givenTechniques, 20),
    userTurns: Math.max(0, Math.min(999, Number(p.userTurns) || 0)),
    userLed: p.userLed === true,
  };

  const shareContext = body.shareContext === true;
  let memory: Memory | undefined;
  if (shareContext && body.memory && typeof body.memory === "object") {
    // Every string is redacted and crisis-screened, like messages (the client does this too).
    const m = body.memory as Record<string, unknown>;
    const household = (m.household && typeof m.household === "object" ? m.household : {}) as Record<string, unknown>;
    const occupation = (m.occupation && typeof m.occupation === "object" ? m.occupation : {}) as Record<string, unknown>;
    const householdDetail = memText(household.detail, 80);
    const occupationDetail = memText(occupation.detail, 80);
    memory = {
      name: memText(m.name, 40),
      household: householdDetail
        ? { kind: (["alone", "family", "partner", "friends", "roommates", "pets", "other"].includes(String(household.kind)) ? household.kind : "other") as NonNullable<Memory["household"]>["kind"], detail: householdDetail }
        : undefined,
      householdSize: typeof m.householdSize === "number" && Number.isFinite(m.householdSize) ? Math.min(30, Math.max(1, Math.round(m.householdSize))) : undefined,
      together: memText(m.together, 100),
      supportPeople: memText(m.supportPeople, 60),
      occupation: occupationDetail
        ? { kind: (["work", "study", "other"].includes(String(occupation.kind)) ? occupation.kind : "other") as NonNullable<Memory["occupation"]>["kind"], detail: occupationDetail }
        : undefined,
      routine: memText(m.routine, 100),
      interests: memList(m.interests, 6),
      dayMood: m.dayMood === "positive" || m.dayMood === "negative" || m.dayMood === "neutral" ? m.dayMood : undefined,
      feelings: memList(m.feelings, 6),
      concerns: memList(m.concerns, 4),
    };
  }

  return { mode: body.mode === "voice" ? "voice" : "chat", messages, progress, memory, shareContext };
}

/** Convert request messages into ChatMessage objects for analysis. */
export function toChatMessages(messages: ChatRequestBody["messages"]): ChatMessage[] {
  return messages.map((m, i) => ({ id: `m${i}`, role: m.role, content: m.content, createdAt: 0, meta: m.meta }));
}
