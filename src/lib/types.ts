export type Role = "user" | "assistant";

/** The five loose conversational stages the companion moves through. */
export type StageId = "intro" | "social" | "lifestyle" | "wellbeing" | "support";

/** Topics the companion may ask about. Used to avoid repeats and honour skips. */
export type TopicId =
  | "day"
  | "name"
  | "household"
  | "household_size"
  | "together"
  | "support_network"
  | "occupation"
  | "occupation_detail"
  | "routine"
  | "free_time"
  | "feelings"
  | "energy_sleep"
  | "stress"
  | "positive"
  | "support_followup"
  | "technique"
  | "safety_check";

export type ProviderId = "groq" | "demo";
export type SafetyLevel = "none" | "distress" | "crisis";
export type SafetyCategory = "suicide" | "self-harm" | "harm-others" | "abuse" | "medical";

export interface SourceRef {
  slug: string;
  title: string;
}

export interface MessageMeta {
  provider?: ProviderId | "safety";
  model?: string;
  stage?: StageId;
  /** Topic of the question asked in this assistant message (demo engine or inferred). */
  topic?: TopicId;
  questionId?: string;
  sources?: SourceRef[];
  safety?: SafetyLevel;
  safetyCategories?: SafetyCategory[];
  /** Knowledge-base slug of a technique offered and awaiting a yes/no. */
  techniqueOffered?: string;
  techniqueGiven?: string;
  /** Groq was unavailable and the scripted fallback answered instead. */
  fallback?: boolean;
  fallbackReason?: string;
  interrupted?: boolean;
  via?: "voice" | "text";
  /** Ari spoke up after the user was quiet (voice check-in). */
  nudge?: boolean;
  /** Conversational move chosen for this reply (strategy engine), for testing and transparency. */
  strategy?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  meta?: MessageMeta;
}

export interface Conversation {
  id: string;
  mode: "chat" | "voice";
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  /** Fictional sample data loaded for demonstrations. */
  sample?: boolean;
}

export interface MoodEntry {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  createdAt: number;
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  tags: string[];
  note?: string;
  sample?: boolean;
}

export interface Settings {
  onboarded: boolean;
  theme: "system" | "light" | "dark";
  /** "auto" uses the server provider (Groq when configured); "demo" keeps everything on-device. */
  aiMode: "auto" | "demo";
  consent: {
    /** Consent to send (redacted) messages to the AI provider. */
    ai: boolean;
    /** Consent to send voice transcripts / use speech recognition. */
    voice: boolean;
    /** Consent to send remembered personal context (name, interests…) to the AI provider. */
    context: boolean;
    decidedAt?: number;
  };
  voice: {
    output: boolean;
    engine: "browser" | "groq";
    voiceName?: string;
    rate: number;
    /** Ari asks a gentle question when the user stays quiet in a voice session. */
    checkIns: boolean;
    /** Seconds of silence before Ari checks in. */
    checkInSeconds: number;
  };
}

/** Facts remembered from the conversation. */
export interface Memory {
  name?: string;
  household?: { kind: "alone" | "family" | "partner" | "friends" | "roommates" | "pets" | "other"; detail: string };
  householdSize?: number;
  together?: string;
  supportPeople?: string;
  occupation?: { kind: "work" | "study" | "other"; detail: string };
  routine?: string;
  interests: string[];
  dayMood?: "positive" | "neutral" | "negative";
  feelings: string[];
  concerns: string[];
}

/** What the analyser learned from a single user message. */
export interface MessageFacts {
  skip: boolean;
  sentiment: number;
  emotions: string[];
  concerns: string[];
  topicRequest: boolean;
  asksDiagnosis: boolean;
  asksIfAI: boolean;
  asksAboutCompanion: boolean;
  goodbye: boolean;
  thanks: boolean;
  affirmative: boolean;
  negative: boolean;
  wantsTechnique: boolean;
  /** Asked Ari to explain something ("what is anxiety?", "why can't I sleep?"). */
  asksExplanation?: boolean;
  name?: string;
  household?: Memory["household"];
  householdSize?: number;
  occupation?: Memory["occupation"];
  interests: string[];
  isShort: boolean;
  /** Significant news that deserves a careful reply (bereavement, breakup, illness, job or home loss, crying). */
  hardNews?: "loss" | "breakup" | "crying" | "health" | "job" | "home";
  /** They asked to vent or just be listened to. */
  wantsToVent?: boolean;
  /** Knowledge-base slug of a technique they asked for by name ("guide me through Worry postponement"). */
  techniqueRequest?: string;
  /** Who they turn to, when they named someone (answers to the support question). */
  supportPerson?: string;
  /** They said they have no one to turn to. */
  noSupport?: boolean;
}

export interface ConversationState {
  stage: StageId;
  memory: Memory;
  answered: TopicId[];
  skipped: TopicId[];
  askedQuestionIds: string[];
  stageQuestionCounts: Record<StageId, number>;
  userTurns: number;
  lastTopic?: TopicId;
  pendingTechnique?: string;
  givenTechniques: string[];
  lastFacts?: MessageFacts;
  /** The user steered toward something specific; follow their lead. */
  userLed: boolean;
}

export interface ServerConfig {
  provider: ProviderId;
  model: string;
  voiceModel: string;
  groqConfigured: boolean;
  stt: boolean;
  tts: boolean;
  ttsVoice?: string;
}

/** Events streamed (as NDJSON) from /api/chat and emitted by the local engine. */
export type ReplyEvent =
  | { type: "meta"; meta: MessageMeta }
  | { type: "delta"; text: string }
  | { type: "done"; meta?: MessageMeta }
  | { type: "error"; message: string };
