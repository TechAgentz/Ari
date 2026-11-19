import { KNOWLEDGE_BASE } from "../knowledge/base";
import { retrieveKnowledge } from "../knowledge/retrieve";
import type { Memory, MessageFacts, TopicId } from "../types";

/**
 * Rule-based understanding of a single user message, interpreted in the
 * context of the topic the companion last asked about. Used to remember
 * facts, honour skipped questions and avoid repeating questions.
 */

const lower = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'");

const SKIP =
  /\b(rather not|prefer not|i'?d rather keep|don'?t (want|wanna|really want) to (talk|say|share|get into|go into|discuss)|not comfortable|skip( (that|this|it))?|pass\b|that'?s private|it'?s private|none of your business|let'?s not|no comment|not ready to (talk|share)|not something i (want|like) to (talk|share)|next question|change the subject)\b/;

/** Topics where a bare "no", "idk" or "doesn't matter" means "I'd rather not say". */
const PERSONAL_TOPICS: TopicId[] = ["name", "household", "household_size", "support_network", "together"];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const NEGATIVE_WORDS = [
  "stressed", "stress", "anxious", "anxiety", "worried", "worry", "nervous", "overwhelmed", "sad", "down", "low",
  "lonely", "tired", "exhausted", "drained", "burned out", "burnt out", "angry", "frustrated", "irritated", "annoyed",
  "hopeless", "empty", "numb", "scared", "afraid", "panicky", "upset", "hurt", "heartbroken", "grieving", "lost",
  "stuck", "unmotivated", "bored", "restless", "guilty", "ashamed", "confused", "rough", "terrible", "awful", "bad",
  "struggling", "hard", "difficult", "tough", "crap", "horrible", "miserable", "meh", "blah", "sick", "depressed",
  "insecure", "jealous", "tense", "on edge", "burnout", "can't sleep", "not sleeping", "intense", "can't switch off",
  "can't relax", "too much", "swamped", "drowning", "piling up", "falling behind", "pressure", "panicking", "lying awake",
  "ugh", "flat", "pointless", "don't know anyone", "dont know anyone", "don't really know anyone", "dont really know anyone", "lonely here", "no one here", "no friends", "barely talk", "on my own all", "no one to talk", "nobody to talk", "long day", "rough day", "hard day", "on my case", "nightmare", "the worst", "fed up",
  "worse", "isolated", "devastated", "gutted", "fight", "fights", "fighting", "argue", "arguing", "argument", "arguments",
  "falling out", "fell out",
];

const POSITIVE_WORDS = [
  "good", "great", "fine", "happy", "calm", "relaxed", "excited", "grateful", "content", "peaceful", "proud",
  "energized", "energised", "hopeful", "joyful", "amazing", "wonderful", "fantastic", "lovely", "nice", "chill",
  "productive", "better", "awesome", "brilliant", "positive", "okay", "alright", "not bad", "pretty good", "fun",
  "enjoyed", "relaxing", "busy but good",
];

/** Words that are never a name, even when they follow "I'm" or make up a whole reply. */
const NAME_STOP = new Set(
  `ok okay fine good great tired not no yes sure well just really so here there alright hi hello hey thanks thank doing
  feeling pretty bit kind sorry anonymous nobody none nothing busy stressed sad happy alone home back new from in at the a
  an and but bad meh lonely glad hungry anxious nervous excited exhausted
  i me my mine myself you your yours he him his she her hers it its we us our they them their this that these those
  who what when where why how which is am are was were be been being have has had do does did will would shall should
  can could may might must going gonna gotta wanna trying getting having looking thinking working studying living
  staying coming leaving waiting hoping also too very quite rather super still already almost always never ever maybe
  perhaps probably possibly kinda sorta sort somewhat literally honestly actually basically seriously totally whatever
  dunno idk nah nope yeah yep yup yea ya hmm hm um uh er erm lol haha ugh nevermind anything anyone anybody everyone
  everybody someone somebody something everything skip pass private secret later now today tomorrow tonight yesterday
  soon morning evening night afternoon weekend complicated hard tough difficult easy simple worried scared afraid sleepy
  upset angry mad sick ill unwell confused lost stuck bored broke done finished ready free around online awake asleep
  alive dead crazy silly weird mental paranoid strange english british american canadian australian irish scottish
  welsh indian christian muslim jewish catholic hindu buddhist atheist gay straight bi trans monday tuesday wednesday
  thursday friday saturday sunday christmas student teacher nurse doctor parent mum mom dad mother father wife husband
  partner single married divorced retired unemployed usually mostly generally normally often sometimes depends
  definitely obviously god`.split(/\s+/),
);
/** Stop words that are also common names, accepted only as a one-word reply to the name question. */
const NAME_ALONE_OK = new Set(["will", "may"]);
const EMOTION_WORDS = new Set([...NEGATIVE_WORDS, ...POSITIVE_WORDS].filter((w) => !w.includes(" ")));

const HOBBIES = [
  "reading", "books", "gaming", "video games", "games", "football", "soccer", "basketball", "tennis", "running",
  "jogging", "cooking", "baking", "painting", "drawing", "music", "guitar", "piano", "singing", "hiking", "walking",
  "yoga", "gym", "working out", "swimming", "cycling", "movies", "films", "tv", "series", "netflix", "anime",
  "gardening", "photography", "writing", "dancing", "travel", "travelling", "traveling", "board games", "chess",
  "knitting", "crafts", "climbing", "fishing", "camping", "meditation", "podcasts", "coding", "volunteering",
  "skateboarding", "surfing", "martial arts", "boxing", "pilates", "crochet", "puzzles", "dog walks", "walks",
  "concerts", "theatre", "theater", "museums", "coffee", "nature", "the beach",
];

const OCCUPATIONS =
  "engineer|nurse|teacher|developer|designer|manager|doctor|accountant|artist|writer|chef|cook|driver|lawyer|consultant|analyst|freelancer|barista|cashier|programmer|scientist|researcher|technician|mechanic|electrician|pharmacist|photographer|musician|entrepreneur|owner|assistant|clerk|officer|marketer|salesperson|student|carer|caregiver|cleaner|builder|plumber|architect|editor|journalist|paramedic|firefighter|police officer|social worker|receptionist|waiter|waitress|bartender|server|tutor|coach|trainer|founder|intern|volunteer|librarian|dentist|vet|veterinarian|farmer|pilot|soldier|retail worker|warehouse worker|data scientist|product manager|software engineer";

const OCCUPATION_RE = new RegExp(`\\b(?:i'?m|i am|work(?:ing)? as)\\s+(?:a|an)\\s+((?:[a-z-]+\\s){0,2}(?:${OCCUPATIONS}))\\b`);

const CONDITIONS =
  "depress\\w*|anxiety disorder|generali[sz]ed anxiety|adhd|bipolar|ocd|ptsd|autis\\w*|on the spectrum|personality disorder|eating disorder|disorder|mentally ill|psychotic|psychosis|borderline|bpd|schizo\\w*|narcissis\\w*|insomnia|burnout|mania|manic";
/** Everyday words that are only a diagnosis question in a tight frame ("Do I have anxiety?", not "anxiety about tomorrow"). */
const COMMON_CONDITIONS = "anxiety|social anxiety|depression|panic disorder|add|adhd|ocd|ptsd|autism|dyslexia|dyspraxia|bipolar|insomnia|burnout";

/** Requests for a diagnosis or self-suspicion of a condition (statements like "I'm depressed" are feelings, not requests). */
const DIAGNOSIS_PATTERNS: RegExp[] = [
  new RegExp(`\\b(do i have|have i got|am i|could i (be|have)|might i (be|have))\\b.{0,40}\\b(${CONDITIONS})\\b`),
  new RegExp(`\\bis (this|it|that) (a sign of |signs of |symptoms of )?(${CONDITIONS})\\b`),
  new RegExp(`\\b(do you think|would you say|could (it|this|that) be|might (it|this|that) be|is it possible|does (this|it|that) sound like|does it seem like|sounds like i (have|might have))\\b.{0,60}\\b(${CONDITIONS})\\b`),
  new RegExp(`\\b(i think|i wonder if|maybe|probably|i might) i('ve| have| might have| am|'m| got)\\b.{0,30}\\b(${CONDITIONS})\\b`),
  new RegExp(`\\b(do i have|have i got|is (this|it|that)|could (this|it|that) be|might (this|it|that) be|could i have|i think i (have|might have|'ve got)|do you think i (have|'ve got))( an?| some| the)? (${COMMON_CONDITIONS})\\b`),
  /\b(diagnose me|my diagnosis|can you diagnose|give me a diagnosis|what('?s| is) wrong with me)\b/,
];

/** Roles people ask about ("are you a licensed psychologist?", "is this a real person?"). */
const AI_ROLES = "real|human|person|people|bot|chatbot|ai|robot|machine|computer|program|therapist|psychologist|psychiatrist|doctor|counsell?or|professional|clinician";
const AI_PATTERNS: RegExp[] = [
  new RegExp(
    `\\bare you (actually |really |even |just |only )?(a |an )?((licensed|actual|real|qualified|trained|certified|registered|proper|genuine|live|human|professional|mental health|medical) ){0,2}(${AI_ROLES})\\b`,
  ),
  /\b(who|what) are you\b/,
  /\b(talking|speaking|chatting) (to|with) (a |an )?(real |actual |live )?(bot|chatbot|human|person|ai|machine|robot|computer|someone real)\b/,
  /\bis (this|it|that) (a |an )?(real |actual |live )?(bot|chatbot|ai|person|human|robot|machine|computer)\b/,
  /\byou(?:'?re| are) (just |only |actually |really )?(a |an )?(bot|chatbot|ai|robot|machine|computer|program)\b/,
];

const CONCERN_LABELS: Record<string, string> = {
  "understanding-stress": "stress",
  "understanding-anxiety": "worry",
  "panic-sensations": "panic",
  "study-stress": "study pressure",
  "low-mood": "low mood",
  burnout: "work stress",
  anger: "frustration",
  "grief-and-loss": "loss",
  "sleep-basics": "sleep",
  "cant-sleep": "sleep",
  loneliness: "loneliness",
  "healthy-communication": "relationship tension",
  boundaries: "boundaries",
  "thought-reframing": "difficult thoughts",
  "worry-time": "worry",
  rumination: "overthinking",
  procrastination: "procrastination",
  "self-compassion": "self-criticism",
};

type HardNews = NonNullable<MessageFacts["hardNews"]>;

const HARD_NEWS_CONCERN: Record<HardNews, string> = {
  loss: "loss",
  breakup: "heartbreak",
  crying: "feeling upset",
  health: "a health worry",
  job: "job loss",
  home: "housing worries",
};

const RELATIONS =
  "mum|mom|mother|dad|father|parents?|grandma|grandmother|grandpa|grandfather|grandad|granddad|nan|nana|gran|granny|grandparents?|sister|brother|sibling|son|daughter|baby|child|husband|wife|partner|boyfriend|girlfriend|fianc[eé]e?|friend|best friend|aunt|auntie|uncle|cousin|niece|nephew|dog|cat|pet|puppy|kitten|hamster|rabbit|bird|horse";

/** Significant news, most serious first. Idioms ("my phone died", "I died laughing") are excluded. */
const HARD_NEWS_PATTERNS: [HardNews, RegExp, RegExp?][] = [
  [
    "loss",
    new RegExp(
      `\\b(died|passed away|funeral|bereave\\w*|miscarr\\w*|lost (my|our|her|his) (\\w+ )?(${RELATIONS})|lost someone|(${RELATIONS}) (just |recently |suddenly |sadly )?passed( on)?\\b(?! (the|his|her|my|their|our|your|a|an|it|its|all|every|with|by|out|through|me|him|them|over|around|along)\\b)|had to (put|have) (him|her|them|my \\w+) (down|to sleep))\\b`,
    ),
    /\b(phone|laptop|battery|car|computer|pc|tablet|ipad|tv|wifi|internet|charger|plants?|headphones|printer|console|engine|game|conversation|chat|party|signal|screen)( \w+)? died\b|\b(nearly|almost|basically|literally|could have|could've|i) died\b|\bdied (laughing|down|of (embarrassment|laughter|boredom|shame))\b/,
  ],
  [
    "health",
    /\b((is|was|been|are|were|i'?m|she'?s|he'?s|they'?re|ended up|admitted|rushed|taken) (\w+ )?(in|into|to) (the )?(hospital|icu|a&e|intensive care|emergency room|er)|hospitali[sz]ed|cancer|tumou?r|chemo(therapy)?|terminally ill|seriously ill|had a stroke|had a heart attack|life support|dementia|alzheimer'?s)\b/,
  ],
  [
    "breakup",
    /\b(broke up|break ?up|breaking up|split up|splitting up|got dumped|been dumped|dumped me|divorc\w*|cheated on me|walked out on (me|us)|ended (it|things) with me|(he|she|they|my (partner|husband|wife|boyfriend|girlfriend|bf|gf|fianc\w*)) (just |has |finally )?left (me|us)\b(?! (a|an|some|the|alone|with|in|on|at|to)\b))/,
  ],
  ["job", /\b(got fired|been fired|fired me|was fired|laid off|lost my job|made redundant|redundancy)\b/],
  ["home", /\b(evict\w*|homeless|lost (my|our) (home|house|flat|apartment))\b/],
  [
    "crying",
    /\b(crying|cried|sobbing|in tears|bawling|weeping|(want|wanted|wanna|going|about|could|need) (to )?cry)\b/,
    /\b(crying|cried) (laughing|with laughter|of laughter)\b/,
  ],
];

function detectHardNews(text: string): HardNews | undefined {
  for (const [kind, re, idiom] of HARD_NEWS_PATTERNS) {
    if (re.test(text) && !(idiom && idiom.test(text) && !re.test(text.replace(idiom, " ")))) return kind;
  }
  return undefined;
}

// ───────────────────────── Techniques asked for by name ─────────────────────────

/** Lower-case, straight quotes removed, dashes unified: "4–6 breathing", "From 'why' to 'what next'". */
const normName = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[’‘'"“”]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim()} `;

/** Common ways people name a technique besides its title and technique name. */
const TECHNIQUE_ALIASES: Record<string, string[]> = {
  "paced-breathing": ["box breathing", "paced breathing", "breathing exercise", "4-6 breathing"],
  "progressive-muscle-relaxation": ["pmr", "muscle relaxation"],
  "grounding-5-4-3-2-1": ["5-4-3-2-1", "54321", "grounding exercise", "grounding"],
  "worry-time": ["worry time", "worry postponement"],
  "self-compassion": ["self-compassion break", "self compassion"],
  journaling: ["free write", "free writing", "journaling", "journalling"],
  "gratitude-savoring": ["three good things", "gratitude exercise", "savouring", "savoring"],
  "mindfulness-basics": ["mindful minute", "mindfulness exercise"],
  anger: ["stop technique", "stop exercise"],
  "thought-reframing": ["reframing"],
  "panic-sensations": ["riding the wave"],
};

const TECHNIQUE_NAMES = KNOWLEDGE_BASE.filter((e) => e.technique)
  .flatMap((e) =>
    [e.technique!.name, e.title, ...(TECHNIQUE_ALIASES[e.slug] ?? [])].map((name) => ({
      slug: e.slug,
      name: normName(name).trim().replace(/^(the|a|an) /, ""),
    })),
  )
  .sort((a, b) => b.name.length - a.name.length);

/** "Guide me through…", "can we try…", "show me how…", "let's practise…". */
const TECHNIQUE_ASK =
  /\b(guide|walk|talk|take|run) me through\b|\bshow me how\b|\bteach me\b|\b(can|could|shall|should) we (do|try|practi[cs]e|go through)\b|\blet'?s (do|try|practi[cs]e|go through)\b|\bi('?d| would)( really)? (like|love) to (do|try|practi[cs]e|learn)\b|\bi want to (do|try|practi[cs]e|learn)\b|\bhelp me (do|try|practi[cs]e|with)\b|\b(can|could) you (guide|walk|talk|take|show|teach|do|run)\b|\bpracti[cs]e\b/;

/** Slug of a knowledge-base technique the user asked for by name, if any. */
function namedTechnique(text: string): string | undefined {
  if (!TECHNIQUE_ASK.test(text)) return undefined;
  const t = normName(text);
  for (const { slug, name } of TECHNIQUE_NAMES) {
    // One-word names ("STOP", "grounding") only count right after the request ("guide me through STOP").
    const phrase = /[\s\d-]/.test(name) || name.length >= 9;
    if (phrase ? t.includes(` ${name} `) : new RegExp(`\\b(through|practi[cs]e|try|do|teach me|show me)( the| a| an| some| that| this)? ${name} `).test(t)) return slug;
  }
  return undefined;
}

// ───────────────────────── Sentiment ─────────────────────────

/** Fixed expressions whose words mislead a word-level score ("couldn't be better" is praise). */
const IDIOMS: [RegExp, string][] = [
  [/\bups? and downs?\b/g, "mixed"],
  [/\b(couldn'?t|could not)( have)? (be|been|gone|get|got|feel|felt)( any| much)? better\b/g, "great"],
  [/\b(can'?t|cannot) (get|be) (any|much) better\b/g, "great"],
  [/\bnever (been|felt|had it)( any)? better\b/g, "great"],
  [/\b(couldn'?t|could not)( have)? (be|been|gone|get|got)( any| much)? worse\b/g, "awful"],
  [/\b(can'?t|cannot) (get|be) (any|much) worse\b/g, "awful"],
  [/\bcould(n'?t)?( have|'?ve)? (be|been) worse\b/g, "okay"],
  [/\b(can'?t|cannot) (complain|grumble)\b|\bno complaints\b|\bnothing to complain about\b/g, "fine"],
  [/\bnothing but\b/g, "only"],
];

const NEGATORS = new Set(["not", "never", "no", "hardly", "isnt", "wasnt", "dont", "nothing", "nobody", "none", "without", "neither", "nor"]);
let SENTIMENT_WORDS: Set<string> | null = null;
const sentimentWords = () => (SENTIMENT_WORDS ??= new Set([...NEGATIVE_WORDS, ...POSITIVE_WORDS].filter((w) => !w.includes(" "))));

/**
 * Whether the word ending at `end` is negated: a negator within the 3 preceding words of the
 * same clause, with no other sentiment word in between ("not feeling good, stressed" negates
 * only "good"; "not a having a good bond" negates "good").
 */
function negatedAt(text: string, end: number): boolean {
  const clause = text.slice(0, end).split(/[,.;!?]|\b(?:and|but|so|because|though|although)\b/).pop() ?? "";
  const toks = clause.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/n't$/, " not").split(" ").at(-1)!).slice(-4);
  for (let i = toks.length - 1; i >= 0; i--) {
    if (NEGATORS.has(toks[i]) || toks[i] === "not") return true;
    if (sentimentWords().has(toks[i])) return false;
  }
  return false;
}

/** Finds `word` in text; returns null, or whether every occurrence was negated. */
function findWord(text: string, word: string): { negated: boolean } | null {
  const re = new RegExp(`(^|[^a-z'])${word.replace(/ /g, "\\s")}(?=[^a-z]|$)`, "g");
  let m: RegExpExecArray | null;
  let found: { negated: boolean } | null = null;
  while ((m = re.exec(text))) {
    if (!negatedAt(text, m.index + m[1].length)) return { negated: false };
    found = { negated: true };
  }
  return found;
}

function scoreSentiment(raw: string): { score: number; emotions: string[] } {
  // Idioms and mixed-feeling phrases shouldn't be scored word by word.
  const text = IDIOMS.reduce((t, [re, to]) => t.replace(re, to), raw);
  let score = 0;
  const emotions: string[] = [];
  for (const w of NEGATIVE_WORDS) {
    const hit = findWord(text, w);
    if (!hit) continue;
    if (hit.negated) score += 0.5;
    else {
      score -= 1;
      emotions.push(w);
    }
  }
  for (const w of POSITIVE_WORDS) {
    if (w === "not bad" || w === "pretty good") continue;
    const hit = findWord(text, w);
    if (!hit) continue;
    if (hit.negated) {
      score -= 1;
      emotions.push(`not ${w}`);
    } else score += w === "fine" || w === "okay" || w === "alright" ? 0.4 : 1;
  }
  if (/\bnot (too |that )?bad\b/.test(text)) score += 0.8;
  return { score, emotions: [...new Set(emotions)].slice(0, 4) };
}

// ───────────────────────── Names ─────────────────────────

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A plausible name, or undefined for verbs, pronouns, feelings, fillers and contractions. */
function cleanName(word: string, wholeReply = false): string | undefined {
  const w = word.toLowerCase();
  if (w.length < 2 || /n't$|'(s|ll|re|ve|d|m)$/.test(w)) return undefined;
  if (!(wholeReply && NAME_ALONE_OK.has(w)) && (NAME_STOP.has(w) || EMOTION_WORDS.has(w))) return undefined;
  // Lower-case "-ing" words are almost always verbs ("going", "trying").
  if (word === w && w.length >= 6 && w.endsWith("ing")) return undefined;
  return /^[A-Z]/.test(word) && word !== word.toUpperCase() ? word : titleCase(w);
}

function extractName(raw: string, lastTopic?: TopicId): string | undefined {
  // "My name is Sam", "I go by Sam", "name's Sam" — any turn.
  const explicit = raw.match(/(?:\bmy name is|\bmy name'?s|\bi go by|(?:^|[.!?,]\s*)name'?s)\s+([a-z][a-z'-]{1,20})/i);
  if (explicit) return cleanName(explicit[1]);
  const atName = lastTopic === "name";
  // "Call me Sam" opening a sentence ("my mum will call me tomorrow" and "call me crazy, but…" don't count).
  const callMe = raw.match(
    /(?:^|[.!?,;]\s*|\b(?:you can|you could|u can|please|just|feel free to|everyone|people|friends|most people)\s+)call me\s+([a-z][a-z'-]{1,20})\b(?!\s*,?\s*but\b)/i,
  );
  if (callMe && (atName || /^[A-Z]/.test(callMe[1]))) return cleanName(callMe[1]);
  // "Hi! I'm Sam." — a capitalised name at the start of a sentence, on any turn.
  const intro = raw.match(
    /(?:^|[.!?,;]\s+|^(?:[Hh]i|[Hh]ey|[Hh]ello|[Hh]iya|[Hh]eya)[\s,!.]+)(?:[Ii]'?m|[Ii] am)\s+([A-Z][a-z'-]{1,20})(?=\s*(?:$|[.!,;:?)]|-|here\b|and\b|btw\b|by the way\b))/,
  );
  if (intro) return cleanName(intro[1]);
  if (!atName) return undefined;

  // Answering "what should I call you?": "I'm Sam", "it's sam, thanks", "Sam", "just Sam", "Sam is fine".
  const named = raw.match(/\b(?:i'?m|i am|it'?s|its|this is)\s+([a-z][a-z'-]{1,20})\b(.*)$/i);
  if (named) {
    const [, word, tail] = named;
    return /^[A-Z]/.test(word) || /^\s*(?:$|[.!,;:)]|thanks|thank you|btw|by the way|lol)/i.test(tail) ? cleanName(word) : undefined;
  }
  let words = raw.replace(/[^A-Za-z' -]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (/^(just|only|um|uh|oh|well)$/i.test(words[0] ?? "")) words = words.slice(1);
  if (!words.length) return undefined;
  const tail = words.slice(1).join(" ").toLowerCase();
  // One word, a name and surname ("sam smith", but not "hope so"), or a name with a polite tail.
  const surname = words.length === 2 && !NAME_STOP.has(tail) && !EMOTION_WORDS.has(tail) && !/'/.test(tail);
  if (words.length === 1 || surname || /^(is fine|is good|is ok|is okay|is great|works|will do|please|thanks|thank you|thx|lol|haha|here|you|and you)$/.test(tail))
    return cleanName(words[0], words.length === 1);
  return undefined;
}

// ───────────────────────── Household ─────────────────────────

const LIVING =
  /\b(live|lives|living|stay|staying|reside|share (a|an|my|the|our) (flat|house|apartment|place|room|home)|at home with|my (flat|house|apartment|place|home) with|moved in with|under (one|the same) roof)\b/;
const HOUSEHOLD_PEOPLE =
  /^(partner|wife|husband|boyfriend|girlfriend|bf|gf|fianc[eé]e?|spouse|roommates?|flatmates?|housemates?|parents|mum|mom|dad|father|mother|family|siblings?|brothers?|sisters?|kids|children|child|sons?|daughters?|baby|grandparents|grandma|grandpa|grandmother|grandfather|nan|gran|aunt|uncle|cousins?|in-laws|friends?|cats?|dogs?|pets?|puppy|kitten)$/;
const HOUSEHOLD_FILLER = new Set(
  "yes yeah yep yup no nope well um so just only mostly both and with my our a an the me i plus also currently now these days at moment right for couple of few some little lovely big two three four five six seven eight nine ten one".split(
    " ",
  ),
);
const ALONE = /\b(alone|by myself|on my own|just me|only me|just myself)\b/;
/** Breakups, bereavements and conflict are news, not a living arrangement. */
const NOT_HOUSEHOLD = /\b(broke up|break ?up|breaking up|split up|dumped|divorc\w*|separat\w*|passed away|passed on|died|dying|death|funeral|left me|cheated|fight\w*|argu\w*|hate|miss(ing)?|lost)\b/;

/** A short reply made only of people (and fillers): "my parents and sister", "with my partner", "two flatmates". */
function peopleOnly(text: string): boolean {
  const words = text.replace(/[^a-z0-9' -]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 10) return false;
  return words.some((w) => HOUSEHOLD_PEOPLE.test(w)) && words.every((w) => HOUSEHOLD_FILLER.has(w) || HOUSEHOLD_PEOPLE.test(w) || /^\d+$/.test(w));
}

/** The part of the message about who they live with, or undefined if it isn't about that. */
function householdScope(text: string, lastTopic?: TopicId): string | undefined {
  const t = text.replace(/\bother half\b/g, "partner");
  if (LIVING.test(t)) {
    // "My parents divorced, and I live with my mum" → only read the living-arrangement clause.
    return NOT_HOUSEHOLD.test(t) ? (t.match(/\b(?:live|lives|living|stay|staying|share|moved in|at home with)\b[^.!?;]*/)?.[0] ?? t) : t;
  }
  if (lastTopic !== "household" && lastTopic !== "household_size") return undefined;
  if (NOT_HOUSEHOLD.test(t) || /\?/.test(t)) return undefined;
  return peopleOnly(t) || (ALONE.test(t) && t.split(/\s+/).length <= 8) ? t : undefined;
}

function extractHousehold(text: string, lastTopic?: TopicId): Memory["household"] | undefined {
  const scope = householdScope(text, lastTopic);
  if (!scope) return undefined;
  const withPhrase = scope.match(/\b(?:with|and)\s+((?:my|our)\s+[a-z ,'-]{2,60}?)(?:[.!?]|$| but| and i| who| which| since| because| so )/)?.[1]?.trim();
  const detail = (fallback: string) => (withPhrase ? `lives with ${withPhrase.replace(/\b(my|our)\b/g, "their")}` : fallback);
  if (ALONE.test(scope) && !/\b(just|only) me and\b|\bme and\b/.test(scope)) {
    if (/\b(cats?|dogs?|pets?|puppy|kitten)\b/.test(scope)) return { kind: "pets", detail: "lives alone with a pet" };
    return { kind: "alone", detail: "lives alone" };
  }
  // With a partner, read who's named in the "with …" phrase so "my wife and our kids" counts as family.
  const who = /\b(partner|wife|husband|boyfriend|girlfriend|bf|gf|fianc[eé]e?|spouse)\b/.test(scope) && withPhrase ? withPhrase : scope;
  if (/\b(parents|mum|mom|dad|father|mother|family|siblings?|brothers?|sisters?|kids|children|child|sons?|daughters?|baby|grandparents|grandma|grandpa|grandmother|grandfather|nan|gran|aunt|uncle|cousins?|in-laws)\b/.test(who))
    return { kind: "family", detail: detail("lives with family") };
  if (/\b(partner|wife|husband|boyfriend|girlfriend|bf|gf|fianc[eé]e?|spouse)\b/.test(scope)) return { kind: "partner", detail: detail("lives with their partner") };
  if (/\b(roommates?|flatmates?|housemates?)\b/.test(scope)) return { kind: "roommates", detail: detail("lives with housemates") };
  if (/\bfriends?\b/.test(scope)) return { kind: "friends", detail: detail("lives with friends") };
  if (/\b(cats?|dogs?|pets?|puppy|kitten)\b/.test(scope)) return { kind: "pets", detail: detail("lives with a pet") };
  const place = scope.match(/\blive (?:in|at) (?:a |an |the )?([a-z ]{3,30}?)(?:[.,!?]|$| with| and| but)/)?.[1];
  return place ? { kind: "other", detail: `lives in ${place.trim()}` } : undefined;
}

const COUNTED = /\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten) (?:\w+ )?(kids|children|sons|daughters|sisters|brothers|siblings|roommates|flatmates|housemates|friends|cousins|boys|girls)\b/g;
const SINGLE_PERSON =
  /\b(wife|husband|partner|boyfriend|girlfriend|fianc[eé]e?|spouse|mum|mom|mother|dad|father|stepdad|stepmum|stepmom|sister|brother|son|daughter|baby|grandma|grandpa|grandmother|grandfather|nan|gran|aunt|uncle|cousin|roommate|flatmate|housemate|friend)\b/g;

/** Household size when everyone is countable: "my wife and our three kids" → 5. */
function inferHouseholdSize(text: string): number | undefined {
  let rest = text.match(/\b(?:live|living|stay|staying) with ([^.!?;]+)/)?.[1] ?? text;
  let count = 1;
  rest = rest.replace(COUNTED, (_, n: string) => {
    count += NUMBER_WORDS[n] ?? Number.parseInt(n, 10);
    return " ";
  });
  rest = rest.replace(/\b(grand)?parents\b/g, () => {
    count += 2;
    return " ";
  });
  if (/\b(family|kids|children|siblings|roommates|flatmates|housemates|friends|cousins|in-laws)\b/.test(rest)) return undefined;
  count += (rest.match(SINGLE_PERSON) ?? []).length;
  return count >= 2 && count < 30 ? count : undefined;
}

function extractHouseholdSize(text: string, lastTopic?: TopicId): number | undefined {
  const m =
    text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:of us|people|in (?:total|the house|my family|the family)|including me)\b/) ??
    text.match(/\bfamily of (\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\b/) ??
    (lastTopic === "household_size" ? text.match(/^\D*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/) : null);
  if (!m) return undefined;
  const n = NUMBER_WORDS[m[1]] ?? Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 && n < 30 ? n : undefined;
}

// ───────────────────────── Support network ─────────────────────────

const NOBODY =
  /\b(nobody|no one|no-one|noone|not anyone|anyone really|(don'?t|do not) (really )?have anyone|haven'?t (really )?got anyone|have no(body| one)|no friends|on my own|just myself|myself (really|mostly)|keep (it|things) to myself)\b|^none\b/;
const SUPPORT_PEOPLE =
  "best friend|close friend|friends?|bestie|mum|mom|mother|dad|father|parents|sister|brother|siblings?|partner|wife|husband|boyfriend|girlfriend|fianc[eé]e?|cousin|aunt|auntie|uncle|grandma|grandpa|gran|nan|nana|granny|grandmother|grandfather|grandparents|son|daughter|kids|colleagues?|coworkers?|co-workers?|boss|manager|teacher|tutor|therapist|counsell?or|doctor|gp|neighbou?r|flatmates?|roommates?|housemates?|dog|cat|pet|mentor|coach|pastor|priest|imam|rabbi|church";

/** Who they turn to ("probably my sister" → "my sister"), or that they have no one. */
function extractSupport(raw: string, text: string): { person?: string; none?: boolean } {
  const person = text.match(new RegExp(`\\b((?:my|our) )?(${SUPPORT_PEOPLE})\\b`));
  const exception = /\b(except|apart from|other than|besides|but|only)\b/.test(text);
  if (NOBODY.test(text) && !(exception && person)) return { none: true };
  if (person) return { person: `${person[1] ? "my " : ""}${person[2]}` };
  const name = raw.match(/\b([A-Z][a-z]{1,15})\b/g)?.map((w) => cleanName(w)).find(Boolean);
  return name ? { person: name } : {};
}

// ───────────────────────── Work, study and interests ─────────────────────────

function extractOccupation(text: string, lastTopic?: TopicId): Memory["occupation"] | undefined {
  const study = text.match(/\b(?:studying|study|majoring in|major in|degree in|course in|doing (?:a|my) (?:degree|masters?|phd) in)\s+([a-z ]{3,40}?)(?:[.,!?]|$| at | and | but )/);
  if (study) return { kind: "study", detail: `studying ${study[1].trim()}` };
  if (/\b(student|university|uni|college|high school|school|phd|master'?s|grad school|classes|semester)\b/.test(text) && !/\b(teacher|teach|work at)\b/.test(text))
    return { kind: "study", detail: "a student" };
  const role = text.match(OCCUPATION_RE);
  if (role) return { kind: "work", detail: `works as ${/^[aeiou]/.test(role[1]) ? "an" : "a"} ${role[1].trim()}` };
  const at = text.match(/\bi work (?:at|in|for)\s+([a-z0-9 &'-]{2,40}?)(?:[.,!?]|$| and | but )/);
  if (at) return { kind: "work", detail: `works in ${at[1].trim()}` };
  if (/\b(retired|between jobs|unemployed|looking for (a )?(job|work)|stay[- ]at[- ]home|full[- ]time (mom|mum|dad|parent)|on leave|carer for)\b/.test(text))
    return { kind: "other", detail: text.match(/\b(retired|between jobs|unemployed|looking for (?:a )?(?:job|work)|stay[- ]at[- ]home \w+|on leave)\b/)?.[0] ?? "not working at the moment" };
  if (/\b(my job|at work|my work|my boss|my shift|working)\b/.test(text) && lastTopic === "occupation") return { kind: "work", detail: "works" };
  return undefined;
}

function extractInterests(text: string): string[] {
  const found = new Set<string>();
  for (const h of HOBBIES) {
    if (new RegExp(`\\b${h}\\b`).test(text)) found.add(h);
  }
  const liked = text.match(/\bi (?:really )?(?:like|love|enjoy|'m into|am into)\s+(?:to\s+)?([a-z ]{3,30}?)(?:[.,!?]|$| and | but | with )/);
  if (liked && liked[1] && !/\b(it|that|this|them|you|when)\b/.test(liked[1])) found.add(liked[1].trim());
  return [...found].slice(0, 4);
}

// ───────────────────────── Requests ─────────────────────────

const TOPIC_REQUEST = new RegExp(
  [
    "\\b(can|could|may) (we|i) (talk|chat|speak|vent) (about|through)\\b",
    "\\b(i want|i wanna|i'?d like|i would like|i need|i wanted|i'?d love|i would love) to (talk|chat|vent|speak) (about|through)\\b",
    "\\b(i'?d|i would) (rather|prefer to) (talk|chat|focus) (about|on)\\b",
    "\\b(can|could) we focus on\\b",
    "\\blet'?s (talk|chat) about\\b",
    "\\b(something|a lot|stuff|things|so much|loads) on my mind\\b",
    "\\bi('?ve| have) been (struggling|dealing|having (a hard|trouble|a rough|a tough))\\b",
    "\\bi('?ve| have) been (feeling|so|really|pretty|quite|very|super|a bit|a little|kind of|kinda|incredibly|extremely)( \\w+){0,2} (stressed|anxious|overwhelmed|worried|low|down|sad|lonely|depressed|burn(ed|t) out|exhausted|panicky|on edge|angry|frustrated|stuck|lost|empty|numb|insecure|tense|drained|unmotivated)\\b",
    "\\bhelp me with\\b",
    "\\bany (tips|advice|ideas|suggestions)\\b",
    "\\bhow (can|do|should) i\\b",
    "\\bwhat (can|should) i do\\b",
    "\\bi need (help|advice)\\b",
  ].join("|"),
);

const AFFIRMATIVE =
  /^(?:(?:oh|um+|uh+|hmm+|well|ok(?:ay)?|alright|right)[,.!]?\s+)?(yes|yeah|yea|yep|yup|ya|aye|sure|ok|okay|k|please|alright|all right|definitely|absolutely|certainly|of course|for sure|why not|go ahead|go on|go for it|sounds (good|great|helpful|nice|lovely|like a plan)|that (sounds|would be|'?d be) (good|great|helpful|nice|lovely|perfect|useful|amazing|wonderful)|that would help|good idea|great idea|nice idea|let'?s (do it|do this|do that|try|go|give it a (go|try|shot))|let'?s[.!]*$|i'?d (love|like) (that|it|to (try|do|give it|have a go|start|hear))|i would (love|like) (that|it|to (try|do|give it|have a go|start|hear))|love to|i'?ll (try|give it a (go|try|shot))|i (can|will) try|worth a (try|shot)|i'?m (in|game|up for it)|happy to|i guess|maybe|count me in|please do)\b/;

const NEGATIVE =
  /^(no(?! (complaints|worries|problem|doubt)\b)|nah|nope|not now|maybe later|not really|not today|not right now|no thanks|no thank you|i'?d rather (not|just talk)|i'?m good|i'?m okay|i'?m ok|i'?m fine|i'?m alright|not for me|i don'?t think so|i'?ll pass)\b/;

const WANTS_TECHNIQUE =
  /\b(tips?|technique|strategy|strategies|what can i do|how (can|do) i (calm|relax|stop|deal|cope|handle|sleep|focus)|help me (calm|relax|sleep|focus)|something to help|breathing)\b|\b(an?|the|that|this|another|quick|short|calming|breathing|grounding|relaxation|relaxing|mindfulness|simple|small) (\w+ )?exercises?\b|\bexercises? (for|to help|that)\b/;

const WANTS_TO_VENT =
  /\b(vent|venting|rant|ranting|get (it|this|something|some things|stuff) off my chest|let (it|some of it|something) out|(just )?(need|want) (you )?to (listen|be heard)|just listen|need someone to listen)\b/;

export function extractFacts(rawInput: string, lastTopic?: TopicId): MessageFacts {
  const raw = rawInput.trim().replace(/[’‘]/g, "'");
  const text = lower(raw);
  const hardNews = detectHardNews(text);
  const sentiment = scoreSentiment(text);
  // Significant news reads as difficult, whatever else the message says.
  const score = hardNews ? Math.min(sentiment.score, 0) - 1.5 : sentiment.score;

  const skip =
    SKIP.test(text) ||
    (/^(no|nope|nah|not really|no thanks|maybe later|i don'?t know|idk|not telling|doesn'?t matter)[.!]*$/.test(text) && !!lastTopic && PERSONAL_TOPICS.includes(lastTopic));
  const topicRequest = !skip && TOPIC_REQUEST.test(text);
  const techniqueRequest = namedTechnique(text);

  // Only treat a topic as a "concern" when the message carries some difficulty, news or a request,
  // or answers "what's been weighing on you?".
  const concernsNeeded = score < 0 || topicRequest || (score <= 0 && (lastTopic === "stress" || lastTopic === "support_followup"));
  const concerns = concernsNeeded
    ? retrieveKnowledge(raw, 2, 3)
        .map((h) => CONCERN_LABELS[h.entry.slug])
        .filter((c): c is string => Boolean(c))
    : [];
  if (hardNews) concerns.unshift(HARD_NEWS_CONCERN[hardNews]);

  const support: { person?: string; none?: boolean } = lastTopic === "support_network" && !skip ? extractSupport(raw, text) : {};
  const household = extractHousehold(text, lastTopic);
  const goodbye =
    /\b(bye|goodbye|good night|goodnight|see you|talk (to you )?later|that'?s all|i'?m done for (now|today))\b/.test(text) ||
    /\b(gotta|got to|have to|need to) go( now| soon)?\b[\s.!]*$/.test(text);

  return {
    skip,
    sentiment: score,
    emotions: sentiment.emotions,
    concerns: [...new Set(concerns)],
    topicRequest,
    asksDiagnosis: DIAGNOSIS_PATTERNS.some((re) => re.test(text)),
    asksIfAI: AI_PATTERNS.some((re) => re.test(text)),
    asksAboutCompanion: /\b(how are you|how about you|and you\??$|what about you|how'?s your day|how is your day|you\?$)/.test(text),
    goodbye,
    thanks: /\b(thanks|thank you|thx|appreciate it|that helped|helpful)\b/.test(text),
    affirmative: AFFIRMATIVE.test(text),
    negative: NEGATIVE.test(text),
    wantsTechnique: !!techniqueRequest || WANTS_TECHNIQUE.test(text),
    asksExplanation: /\b(what (is|are|does|causes|happens)|what'?s (the difference|happening|going on in)|why (do|does|am|is|can'?t|cant|would)|how (does|do|come)|explain|tell me (more )?about|help me understand|is it normal)\b/.test(text),
    name: skip ? undefined : extractName(raw, lastTopic),
    household,
    householdSize:
      extractHouseholdSize(text, lastTopic) ??
      (household && ["family", "friends", "roommates"].includes(household.kind) ? inferHouseholdSize(text) : undefined),
    occupation: hardNews === "job" ? undefined : extractOccupation(text, lastTopic),
    interests: extractInterests(text),
    isShort: text.split(/\s+/).length <= 3,
    ...(hardNews ? { hardNews } : {}),
    ...(!skip && WANTS_TO_VENT.test(text) ? { wantsToVent: true } : {}),
    ...(techniqueRequest ? { techniqueRequest } : {}),
    ...(support.person ? { supportPerson: support.person } : {}),
    ...(support.none ? { noSupport: true } : {}),
  };
}

/** Infer which topic an assistant message asked about, from its final question. */
export function inferTopic(assistantText: string): TopicId | undefined {
  const t = lower(assistantText);
  const questions = t.match(/[^.!?]*\?/g);
  const q = questions ? questions[questions.length - 1] : "";
  if (!q) return undefined;
  if (/\b(what should i call you|your name|call you|name you)\b/.test(q)) return "name";
  if (/\bhow many\b/.test(q)) return "household_size";
  if (/\b(live with|living with|on your own|who'?s at home|share (a|your) (home|place)|household|live alone)\b/.test(q)) return "household";
  if (/\b(together|as a family|with them)\b/.test(q)) return "together";
  if (/\b(turn to|lean on|talk to when|support)\b/.test(q)) return "support_network";
  if (/\b(work|study|studies|studying|job|school|fills (most of )?your days|do for a living)\b/.test(q)) return "occupation";
  if (/\b(typical day|routine|mornings?|evenings?|weekday)\b/.test(q)) return "routine";
  if (/\b(free time|hobb|for fun|unwind|downtime|enjoy doing|spare time)\b/.test(q)) return "free_time";
  if (/\b(sleep|energy)\b/.test(q)) return "energy_sleep";
  if (/\b(weighing on|stress|challeng|on your mind|bothering)\b/.test(q)) return "stress";
  if (/\b(been feeling|how have you been|how are you feeling|feeling lately|mood)\b/.test(q)) return "feelings";
  if (/\b(gone well|good moment|looking forward|grateful)\b/.test(q)) return "positive";
  if (/\b(try|exercise|technique|walk you through)\b/.test(q)) return "technique";
  if (/\b(day|today)\b/.test(q)) return "day";
  return undefined;
}
