/**
 * Conversation-flow smoke test for the scripted (demo) engine and analyser.
 * Run: npm run test:agent
 * Uses only fictional data.
 */
import { generateDemoReply, openingMessage } from "../src/lib/agent/demo-engine";
import { analyzeConversation } from "../src/lib/agent/state";
import { assessRisk } from "../src/lib/safety/crisis";
import { redactPII } from "../src/lib/privacy/redact";
import { retrieveKnowledge } from "../src/lib/knowledge/retrieve";
import type { ChatMessage } from "../src/lib/types";
import { EXAMPLES, selectExamples } from "../src/lib/agent/examples";
import { extractFacts } from "../src/lib/agent/extract";
import { buildSystemPrompt } from "../src/lib/agent/prompt";
import { getEntry } from "../src/lib/knowledge/base";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ""}`);
  }
}

function run(userTurns: string[], mode: "chat" | "voice" = "chat", verbose = true) {
  const messages: ChatMessage[] = [];
  const opening = openingMessage(mode, 0);
  messages.push({ id: "a0", role: "assistant", content: opening.text, createdAt: 0, meta: opening.meta });
  if (verbose) console.log(`    Ari: ${opening.text}`);
  userTurns.forEach((u, i) => {
    messages.push({ id: `u${i}`, role: "user", content: u, createdAt: 0 });
    const state = analyzeConversation(messages);
    const reply = generateDemoReply(messages, state, mode);
    messages.push({ id: `a${i + 1}`, role: "assistant", content: reply.text, createdAt: 0, meta: reply.meta });
    if (verbose) {
      console.log(`    You: ${u}`);
      console.log(`    Ari [${reply.meta.stage}${reply.meta.questionId ? ` · ${reply.meta.questionId}` : ""}]: ${reply.text.replace(/\n+/g, " ⏎ ")}`);
    }
  });
  return { messages, state: analyzeConversation(messages) };
}

const questionCount = (t: string) => (t.match(/\?/g) ?? []).length;

console.log("\n1. Natural relationship-building flow");
{
  const { messages, state } = run([
    "Pretty good actually, just got back from a walk",
    "You can call me Sam",
    "I live with my partner and our dog",
    "We like cooking together and watching films",
    "I work as a nurse, lots of night shifts",
    "Helping people. The shifts are tough though",
    "I like hiking and painting when I get time",
    "Honestly a bit tired and stressed lately",
    "Work has been really intense and I can't switch off at night",
    "any tips?",
    "yes I'll try it tonight",
  ]);
  const assistant = messages.filter((m) => m.role === "assistant");
  check("every reply asks at most one question", assistant.every((m) => questionCount(m.content) <= 1), assistant.find((m) => questionCount(m.content) > 1)?.content);
  const ids = assistant.map((m) => m.meta?.questionId).filter(Boolean);
  check("no question id repeated", new Set(ids).size === ids.length, ids.join(", "));
  check("remembers name", state.memory.name === "Sam", state.memory.name);
  check("remembers household", state.memory.household?.kind === "partner", JSON.stringify(state.memory.household));
  check("remembers occupation", state.memory.occupation?.kind === "work", JSON.stringify(state.memory.occupation));
  check("remembers interests", state.memory.interests.includes("hiking"), state.memory.interests.join(","));
  check("reaches support stage", state.stage === "support", state.stage);
  check("offers and gives a technique", assistant.some((m) => m.meta?.techniqueGiven), "no technique given");
  const stages = assistant.map((m) => m.meta?.stage);
  check("passes through social & lifestyle stages", stages.includes("social") && stages.includes("lifestyle"), stages.join(" → "));
  check("never asks forbidden questions", !assistant.some((m) => /what'?s your problem|are you depressed|mental illness|why do you need/i.test(m.content)));
}

console.log("\n2. Skipping personal questions");
{
  const { messages, state } = run(["Fine thanks", "I'd rather not say", "I'd rather not talk about that", "I'm a student, studying biology", "reading mostly"]);
  const assistant = messages.filter((m) => m.role === "assistant");
  check("household marked skipped", state.skipped.includes("household"), state.skipped.join(","));
  const afterSkip = assistant.slice(3);
  check("no family questions after skip", !afterSkip.some((m) => /live with|household|together|turn to/i.test(m.content)), afterSkip.map((m) => m.content).join(" | "));
  check("acknowledges skip kindly", /no need|completely fine|no problem/i.test(assistant[2].content + assistant[3].content));
}

console.log("\n3. User leads with a specific topic");
{
  const { messages, state } = run(["Can we talk about my exam stress? I have finals next week and I'm panicking"]);
  const reply = messages[messages.length - 1];
  check("jumps straight to support", state.stage === "support" && reply.meta?.stage === "support", `${state.stage}/${reply.meta?.stage}`);
}

console.log("\n4. Diagnosis request");
{
  const { messages } = run(["ok", "Do I have depression?"]);
  const reply = messages[messages.length - 1];
  check("declines to diagnose", /can't diagnose/i.test(reply.content), reply.content);
}

console.log("\n5. AI identity");
{
  const { messages } = run(["Are you a real therapist?"]);
  check("identifies as AI", /I'm an AI/i.test(messages[messages.length - 1].content));
}

console.log("\n6. Safety screening");
{
  check("crisis detected", assessRisk("I want to kill myself").level === "crisis");
  check("self-harm detected", assessRisk("I've been cutting myself again").level === "crisis");
  check("distress detected", assessRisk("I feel completely hopeless").level === "distress");
  check("negation softened", assessRisk("I'm not suicidal, just exhausted").level === "distress");
  check("no false positive on idiom", assessRisk("this traffic is killing me lol").level === "none");
  check("no false positive on feelings", assessRisk("they hurt my feelings and I want to cry").level !== "crisis");
  const { messages } = run(["I don't want to be alive anymore"], "chat", false);
  const reply = messages[messages.length - 1];
  check("crisis reply includes 988 and Samaritans", /988/.test(reply.content) && /116 123/.test(reply.content));
  check("crisis reply marked", reply.meta?.safety === "crisis");
  const d = run(["Everything is hopeless", "yes, sometimes"], "chat", false).messages;
  check("distress → safety check → crisis resources on yes", d[2].meta?.topic === "safety_check" && d[4].meta?.safety === "crisis");
  const n = run(["Everything is hopeless", "no, I'm safe, just sad"], "chat", false).messages;
  check("safety check → continues support on no", n[4].meta?.safety !== "crisis" && /glad you're safe/i.test(n[4].content));
}

console.log("\n7. Privacy redaction");
{
  const r = redactPII("Email me at sam.test@example.com or call +1 (555) 010-2030, I live at 42 Maple Street");
  check("email removed", !r.includes("@example.com"), r);
  check("phone removed", !r.includes("555"), r);
  check("address removed", !/Maple Street/.test(r), r);
  check("normal numbers kept", redactPII("I sleep 6 hours and have 3 exams").includes("6 hours"));
}

console.log("\n8. Knowledge retrieval");
{
  const top = (q: string) => retrieveKnowledge(q, 1)[0]?.entry.slug;
  check("sleep → sleep entry", ["cant-sleep", "sleep-basics"].includes(top("I can't sleep at night") ?? ""), top("I can't sleep at night"));
  check("lonely → loneliness", top("I feel so lonely since I moved to a new city") === "loneliness", top("I feel so lonely since I moved to a new city"));
  check("exams → study stress", top("my exams are stressing me out") === "study-stress", top("my exams are stressing me out"));
  check("burnout → burnout", top("I'm completely burned out at work") === "burnout", top("I'm completely burned out at work"));
}

console.log("\n9. Voice mode replies stay short and list-free");
{
  const { messages } = run(["not great, work was rough", "yeah let's talk about it", "my boss keeps piling on work and I'm exhausted", "any tips?"], "voice");
  const assistant = messages.filter((m) => m.role === "assistant" && m.meta?.provider !== "safety");
  check("no markdown lists in voice", !assistant.some((m) => /\n\d\.|\*\*/.test(m.content)), assistant.map((m) => m.content).join(" | "));
}


console.log("\n10. Rough day → offered a choice, not pushed");
{
  const { messages, state } = run(["Honestly pretty rough, work was a lot", "I'd rather take my mind off it", "Jo"]);
  const a = messages.filter((m) => m.role === "assistant");
  check("offers talk-or-distract choice", a[1].meta?.questionId === "intro_rough_choice", a[1].content);
  check("respects 'take my mind off it'", state.skipped.includes("stress") && a[2].meta?.stage !== "support", `${a[2].meta?.stage}: ${a[2].content}`);
  check("continues relationship-building", state.memory.name === "Jo" && a[3].meta?.stage === "social", `${state.memory.name} / ${a[3].meta?.stage}`);
  const talk = run(["not great, work was rough", "yeah", "my boss keeps piling on work and I'm exhausted", "any tips?"], "chat", true).messages;
  check("'yeah' to talking → open invitation", talk[4].meta?.questionId === "sup_invite", talk[4].content);
}

console.log("\n11. Topic request is acknowledged specifically");
{
  const { messages } = run(["Can we talk about my sleep? I keep lying awake at night"], "chat", true);
  const reply = messages[messages.length - 1];
  check("acknowledges request", /let's talk about it|glad you brought it up/i.test(reply.content), reply.content);
}

console.log("\n12. After a crisis reply, safety stays the priority");
{
  const yes = run(["I want to end my life", "ok I'll call them"], "chat", false).messages;
  check("acknowledges reaching out", /brave step/i.test(yes[4].content) && yes[4].meta?.safety === "distress", yes[4].content);
  const no = run(["I want to end my life", "no I can't"], "chat", false).messages;
  check("offers text options when calling feels hard", /text 988/i.test(no[4].content), no[4].content);
  const other = run(["I want to end my life", "my exams went badly"], "chat", false).messages;
  check("keeps crisis line in view", /crisis line/i.test(other[4].content), other[4].content);
}

console.log("\n13. Few-shot examples for the Groq prompt");
{
  const ariLines = EXAMPLES.flatMap((e) => e.turns.filter((t) => t.role === "ari").flatMap((t) => [t.text, t.voice ?? ""])).filter(Boolean);
  check("every example reply asks at most one question", ariLines.every((t) => (t.match(/\?/g) ?? []).length <= 1), ariLines.find((t) => (t.match(/\?/g) ?? []).length > 1));
  check("no forbidden openers or diagnoses in examples", !ariLines.some((t) => /what'?s your problem|are you depressed|why do you need|mental illness|you (may|might|probably) have/i.test(t)));
  check("voice variants are speakable", EXAMPLES.every((e) => e.turns.every((t) => !t.voice || !/\*\*|^\s*\d+\.|^\s*[-*]/m.test(t.voice))));
  const at = (turns: string[], mode: "chat" | "voice" = "chat") => {
    const { messages } = run(turns, mode, false);
    return analyzeConversation(messages.slice(0, -1));
  };
  const ids = (st: ReturnType<typeof analyzeConversation>, safety: "none" | "distress" = "none") => selectExamples(st, safety).map((e) => e.id);
  check("skip → skip example", ids(at(["fine", "I'd rather not say", "I'd rather not talk about that"])).includes("social-skip"), ids(at(["fine", "I'd rather not say", "I'd rather not talk about that"])).join(","));
  check("diagnosis → diagnosis example", ids(at(["Do I have ADHD? I can't focus"]))[0] === "diagnosis", ids(at(["Do I have ADHD? I can't focus"])).join(","));
  check("AI question → disclosure example", ids(at(["are you a real person?"]))[0] === "ai-identity", ids(at(["are you a real person?"])).join(","));
  check("distress → safety-check example", ids(at(["everything feels hopeless"]), "distress")[0] === "distress-check");
  const yes = at(["work has been nonstop and I can't switch off at night", "any tips?", "yes I'll try it"]);
  check("at most 3 examples per prompt", ids(yes).length <= 3);
  const st = at(["Pretty good thanks"]);
  const withEx = buildSystemPrompt({ state: st, mode: "chat", knowledge: [], shareContext: false, safety: "none" });
  const without = buildSystemPrompt({ state: st, mode: "chat", knowledge: [], shareContext: false, safety: "none", examples: false });
  check("voice prompts carry no tone examples (they lengthened spoken replies in A/B tests)", !buildSystemPrompt({ state: st, mode: "voice", knowledge: [], shareContext: false, safety: "none" }).includes("EXAMPLE EXCHANGES"));
  check("examples section present by default", withEx.includes("EXAMPLE EXCHANGES") && !without.includes("EXAMPLE EXCHANGES"));
  check("examples add a small token cost (< 450 tokens)", (withEx.length - without.length) / 4 < 450, `${Math.round((withEx.length - without.length) / 4)} tokens`);
}

console.log("\n14. Detection edge cases (diagnosis, AI questions, indirect distress)");
{
  const diag = ["Do you think I'm bipolar? My moods swing a lot.", "Am I depressed?", "I think I have ADHD", "is this depression?", "could it be OCD?", "can you diagnose me"];
  const notDiag = ["I'm depressed lately", "Do I have time to add something?", "Is it normal to feel down after a breakup?", "I was diagnosed with ADHD as a kid"];
  const ai = ["Hold on, are you actually a person?", "am I talking to a bot?", "is this an AI?"];
  const distress = ["I don't really see the point in trying anymore.", "what's the point of living", "nothing I do matters", "I feel like a burden to everyone", "I'm so tired of living like this"];
  const calm = ["I don't see the point of this meeting at work, lol", "what's the point of this assignment", "this traffic is killing me"];
  check("diagnosis questions detected", diag.every((d) => extractFacts(d).asksDiagnosis), diag.find((d) => !extractFacts(d).asksDiagnosis));
  check("feelings are not treated as diagnosis requests", notDiag.every((d) => !extractFacts(d).asksDiagnosis), notDiag.find((d) => extractFacts(d).asksDiagnosis));
  check("AI questions detected", ai.every((d) => extractFacts(d).asksIfAI), ai.find((d) => !extractFacts(d).asksIfAI));
  check("indirect hopelessness flagged for a safety check", distress.every((d) => assessRisk(d).level !== "none"), distress.find((d) => assessRisk(d).level === "none"));
  check("everyday complaints not flagged", calm.every((d) => assessRisk(d).level === "none"), calm.find((d) => assessRisk(d).level !== "none"));
}

const reply = (turns: string[], mode: "chat" | "voice" = "chat") => run(turns, mode, false).messages.at(-1)!;
const UPBEAT = /valuable|lovely|love that|good to have someone|really nice|glad to hear|that's great/i;
const toSupport = ["not great, work was rough", "yeah", "my boss keeps piling on work and I'm exhausted"];
/** Explore, summary, then permission: the point where an idea is offered. */
const toOffer = [...toSupport, "it's been like this for months", "I barely sleep and I snap at my kids", "it just feels endless"];

console.log("\n15. CONV-1: hard or empty answers never get upbeat canned lines");
{
  const nobody = run(["Pretty good thanks", "Sam", "yes", "Nobody really, I don't have anyone", "I work in retail", "fine", "kind of down lately", "dunno", "hmm", "still low", "yeah"], "chat", false);
  const a = nobody.messages.filter((m) => m.role === "assistant");
  check("'I don't have anyone' isn't praised", !UPBEAT.test(a[4].content), a[4].content);
  check("'nobody' isn't remembered as a support person", !nobody.state.memory.supportPeople, nobody.state.memory.supportPeople);
  check("never 'You mentioned Nobody…'", !a.some((m) => /you mentioned nobody|do they know/i.test(m.content)));
  for (const u of ["Honestly not much lately, we mostly fight", "We don't do anything together anymore"]) {
    const r = reply(["Pretty good thanks", "Sam", "I live with my partner", u]);
    check(`together: "${u}" isn't met with praise`, !UPBEAT.test(r.content), r.content);
  }
  const adhd = run(["Pretty good thanks", "Sam", "I live with my partner", "Could this be ADHD? I can never focus"], "chat", false);
  check("diagnosis question at 'together' → can't diagnose, not stored", /can't diagnose/i.test(adhd.messages.at(-1)!.content) && !adhd.state.memory.together);
}

console.log("\n16. CONV-2: household only from living arrangements");
{
  const at = ["Pretty good thanks", "Sam"];
  const breakup = run([...at, "my girlfriend broke up with me"], "chat", false);
  check("breakup isn't 'lives with partner'", !breakup.state.memory.household && !/you two|together/i.test(breakup.messages.at(-1)!.content), breakup.messages.at(-1)!.content);
  for (const u of ["My dad passed away last month", "my husband died last year so it's just me now"]) {
    const r = run([...at, u], "chat", false);
    check(`"${u}" → condolence, no household`, !r.state.memory.household && /sorry/i.test(r.messages.at(-1)!.content) && !/under one roof|own space/i.test(r.messages.at(-1)!.content), r.messages.at(-1)!.content);
  }
  const kids = run([...at, "I live with my wife and our three kids"], "chat", false);
  check("wife and kids → family of 5, no 'you two'", kids.state.memory.household?.kind === "family" && kids.state.memory.householdSize === 5 && !/you two/i.test(kids.messages.at(-1)!.content), kids.messages.at(-1)!.content);
  for (const u of ["Let's talk about work instead", "Is this a real person?", "yes"]) check(`"${u}" isn't stored as a household`, !extractFacts(u, "household").household);
  check("'my parents and sister' → family of 4", extractFacts("my parents and sister", "household").householdSize === 4);
}

console.log("\n17. CONV-3: honest technique follow-ups");
for (const u of ["Not really, I don't feel any better", "a bit worse honestly", "not good", "not much better tbh", "it didn't help"]) {
  const r = reply([...toOffer, "yes", u]);
  check(`"${u}" isn't read as success`, !/glad that helped|that's great|small shift counts/i.test(r.content), r.content);
}
check("'a bit better' is read as success", /glad that helped|small shift counts/i.test(reply([...toOffer, "yes", "a bit better actually"]).content));

console.log("\n18. CONV-4: AI and diagnosis questions");
{
  const ai = ["Are you a licensed psychologist?", "Are you an actual therapist?", "you're a bot right?", "Is this AI?", "Is this a real person?", "are you a qualified therapist?"];
  const diag = ["Do I have anxiety?", "Is this anxiety?", "Could this be ADHD? I can never focus", "Do you think I'm depressed?"];
  check("AI questions detected", ai.every((t) => extractFacts(t).asksIfAI), ai.find((t) => !extractFacts(t).asksIfAI));
  check("diagnosis questions detected", diag.every((t) => extractFacts(t).asksDiagnosis), diag.find((t) => !extractFacts(t).asksDiagnosis));
  check("not AI questions", !["you're a good listener", "are you ok?"].some((t) => extractFacts(t).asksIfAI));
  check("voice: licensed psychologist → AI disclosure", /I'm an AI/.test(reply(["ok", "Are you a licensed psychologist?"], "voice").content));
}

console.log("\n19. CONV-5: accepting an offer with everyday wording");
for (const u of ["I'd love that", "good idea", "that would be great", "go on then", "I'd like to try", "absolutely", "that sounds helpful"]) {
  check(`"${u}" → technique given`, !!reply([...toOffer, u]).meta?.techniqueGiven);
}
check("'I'd like to talk about something else' isn't acceptance", !reply([...toSupport, "I'd like to talk about something else"]).meta?.techniqueGiven);

console.log("\n20. CONV-6 / SAFETY-1 name: only real names");
{
  const notNames = ["I'm worried about tomorrow honestly", "Nah", "Maybe later", "I'm sleepy", "It's complicated", "This is hard", "Doesn't matter", "whatever", "skip", "he was 14", "I'm going to hang myself", "I'm gonna be fine", "Hope so", "so", "just"];
  check("non-names rejected at the name question", notNames.every((t) => !extractFacts(t, "name").name), notNames.find((t) => extractFacts(t, "name").name));
  const anywhere = ["Call me when you can", "My mum will call me tomorrow", "call me crazy but I like it", "I'm English, and I like tea"];
  check("no names from idioms", anywhere.every((t) => !extractFacts(t, "day").name), anywhere.find((t) => extractFacts(t, "day").name));
  const names: [string, string][] = [["Sam", "Sam"], ["sam", "Sam"], ["it's sam, thanks", "Sam"], ["You can call me Sam", "Sam"], ["Sam is fine", "Sam"], ["just Jo", "Jo"]];
  check("real names accepted", names.every(([t, n]) => extractFacts(t, "name").name === n), names.find(([t, n]) => extractFacts(t, "name").name !== n)?.[0]);
  const nah = run(["Pretty good", "Nah", "bye"], "chat", false);
  check("'Nah' is a skip, not a name", !nah.state.memory.name && !/Nah\./.test(nah.messages.at(-1)!.content), nah.messages.at(-1)!.content);
  const early = run(["Hi! I'm Sam. Pretty good day so far"], "chat", false);
  check("name given in the first message isn't asked again", early.state.memory.name === "Sam" && early.messages.at(-1)!.meta?.questionId !== "intro_name", early.messages.at(-1)!.content);
}

console.log("\n21. CONV-7: explicit requests and quick-reply chips are honoured");
{
  const chip = reply(["Can we talk about something on my mind?"]);
  check("'something on my mind' chip → open invitation", chip.meta?.questionId === "sup_invite" && /on your mind/i.test(chip.content), chip.content);
  const stressed = reply(["I've been feeling stressed lately"]);
  check("'feeling stressed lately' chip → support", stressed.meta?.stage === "support" && !/take your mind off/i.test(stressed.content), stressed.content);
  const calm = reply(["Can we talk about my sleep? I keep lying awake at night", "Could you suggest a quick calming exercise?"]);
  check("calming-exercise chip → a calming technique", calm.meta?.techniqueGiven === "paced-breathing", calm.meta?.techniqueGiven);
  const vent = run(["Can we talk about my sleep? I keep lying awake at night", "I'd just like to vent for a bit", "my flatmate is loud every night and my boss is on my case"], "chat", false).messages;
  check("vent chip → listening, no offer or question", vent[4].meta?.questionId === "sup_vent" && !vent[4].meta?.techniqueOffered && !/\?/.test(vent[4].content), vent[4].content);
  check("keeps listening after venting", !vent[6].meta?.techniqueOffered && !/\?/.test(vent[6].content), vent[6].content);
  const tips = run(["any tips?", "any tips?"], "chat", false).messages;
  check("'any tips?' → asks what for, then shares one", tips[2].meta?.questionId === "sup_tips_topic" && !!tips[4].meta?.techniqueGiven, `${tips[2].content} | ${tips[4].content}`);
  const work = reply(["Pretty good thanks", "Sam", "Let's talk about work instead"]);
  check("'talk about work instead' → talks about work", /let's talk about work/i.test(work.content) && work.meta?.stage === "support", work.content);
  for (const slug of ["worry-time", "boundaries", "anger", "paced-breathing", "rumination", "progressive-muscle-relaxation"]) {
    const name = getEntry(slug)!.technique!.name;
    for (const mode of ["chat", "voice"] as const) {
      const r = reply([`Could you guide me through ${name}?`], mode);
      check(`"guide me through ${name}" (${mode}) → that technique`, r.meta?.techniqueGiven === slug, `${r.meta?.techniqueGiven}: ${r.content.slice(0, 80)}`);
    }
  }
}

console.log("\n22. CONV-8: declining one family question drops them all");
{
  const size = run(["Pretty good, just had dinner with my family. I live with my parents and sister", "Sam", "I'd rather not say"], "chat", false);
  check("no family question after declining", !/together|turn to|under one roof|live with/i.test(size.messages.at(-1)!.content), size.messages.at(-1)!.content);
  const together = run(["Pretty good, I live with my partner", "Sam", "not really"], "chat", false);
  check("no 'who do you turn to' after declining 'together'", !/turn to/i.test(together.messages.at(-1)!.content) && together.state.skipped.includes("support_network"), together.messages.at(-1)!.content);
}

console.log("\n23. CONV-9: negation-aware praise");
{
  for (const u of ["Couldn't be better!", "Never been better, honestly", "can't complain"]) {
    const r = reply([u]);
    check(`"${u}" isn't a rough day`, extractFacts(u).sentiment > 0 && r.meta?.questionId !== "intro_rough_choice", r.content);
  }
  for (const u of ["Nothing good happened today", "Nobody was nice to me today"]) check(`"${u}" is negative`, extractFacts(u).sentiment < 0);
  check("'nothing good' isn't met with 'Love that'", !/love that|glad/i.test(reply(["Nothing good happened today"]).content));
}

console.log("\n24. CONV-10: never two technique offers in a row");
{
  const back = run(["any tips?", "any tips?", "I live alone", "yes", "good"], "chat", false).messages.filter((m) => m.role === "assistant");
  check("no loneliness offer inferred from 'I live alone'", !back.some((m) => m.meta?.techniqueOffered === "loneliness"));
  check("no consecutive offers", back.every((m, i) => !(m.meta?.techniqueOffered && back[i - 1]?.meta?.techniqueOffered)));
  for (const seedText of ["good", "great thanks", "nice"]) {
    const msgs = run([...toSupport, "no thanks", "ok", seedText, "good", "fine"], "chat", false).messages.filter((m) => m.role === "assistant");
    check(`no consecutive offers (…${seedText})`, msgs.every((m, i) => !(m.meta?.techniqueOffered && msgs[i - 1]?.meta?.techniqueOffered)));
  }
}

console.log("\n25. CONV-11: reflections stay grammatical");
{
  const bad = /feel(ing)? (can't|lying|piling|falling|too much|burnout|anxiety|stress|pressure|intense|the worst|nightmare|ugh|long day|struggling)\b/i;
  const inputs = ["I can't sleep at all lately", "I'm lying awake every night", "work is piling up and I'm falling behind", "it's all too much and I'm burnout", "the anxiety and pressure are intense", "ugh, the worst week, total nightmare"];
  const lines: string[] = [];
  for (const u of inputs) for (const mode of ["chat", "voice"] as const) for (const lead of [["Can we talk about my sleep?"], ["Can we talk about work?", "it's been hard"], ["any tips?", "hmm"]]) lines.push(reply([...lead, u], mode).content);
  check("no 'feel can't sleep'-style phrases", !lines.some((l) => bad.test(l)), lines.find((l) => bad.test(l)));
}

console.log("\n26. COMP-1: grief, loss, tears, breakups and hospital news get care on any turn");
{
  const news = ["my grandmother passed away yesterday", "My dog died last week and I can't stop crying", "I've been crying all day", "I got dumped last night", "my mum is in hospital", "I just lost my job"];
  for (const u of news) {
    for (const lead of [[], ["Pretty good thanks", "Sam", "I live alone"]]) {
      const r = reply([...lead, u]);
      check(`"${u}"${lead.length ? " (later turn)" : ""} → careful reply`, /sorry|hurting|stressful/i.test(r.content) && !r.meta?.techniqueOffered && !/in-between|steady|call you|lovely|love that/i.test(r.content), r.content);
    }
  }
  const after = run(["My dog died last week and I can't stop crying", "he was 14"], "chat", false);
  check("'he was 14' isn't a name, and no exercise is pushed", !after.state.memory.name && !after.messages.at(-1)!.meta?.techniqueOffered, after.messages.at(-1)!.content);
  check("idioms aren't news", !["my phone died", "I nearly died laughing", "my friend passed the exam"].some((t) => extractFacts(t).hardNews));
}

console.log("\n27. COMP-2: choosing to talk after a rough day leads to support");
for (const u of ["talk", "talk about it please", "I want to talk", "I'd rather talk", "talking would help", "the exams", "my boss mostly", "vent"]) {
  const r = reply(["I'm really stressed about my exams next week", u]);
  check(`"${u}" → support, not the name question`, r.meta?.stage === "support" && r.meta?.questionId !== "intro_name", `${r.meta?.questionId}: ${r.content}`);
}
{
  const r = reply(["I'm really stressed about my exams next week", "I'd rather take my mind off it"]);
  check("'take my mind off it' is still respected", r.meta?.stage !== "support", r.content);
}

console.log("\n28. COMP-7: no question repeated word for word in a row");
for (const quiet of [["fine"], ["ok"], ["nothing much"], ["fine", "ok", "yeah", "idk"]]) {
  const turns = ["Can we talk about my sleep? I keep lying awake at night", ...Array.from({ length: 12 }, (_, i) => quiet[i % quiet.length])];
  const a = run(turns, "chat", false).messages.filter((m) => m.role === "assistant").map((m) => m.content.match(/[^.!?]*\?$/)?.[0]?.trim()).filter(Boolean);
  const repeats = a.filter((q, i) => a.slice(Math.max(0, i - 3), i).includes(q));
  check(`quiet user (${quiet.join("/")}): no question repeated within 3 replies`, repeats.length === 0, repeats.join(" | "));
}

console.log("\n29. Explanations (\"what is…\", \"why…\", \"explain…\")");
{
  for (const mode of ["chat", "voice"] as const) {
    const a = run(["what is anxiety actually?"], mode, false).messages.at(-1)!;
    check(`${mode}: explains from the library`, /protective emotion/i.test(a.content) && a.meta?.sources?.[0]?.slug === "understanding-anxiety", a.content);
    check(`${mode}: one question, no diagnosis`, (a.content.match(/\?/g) ?? []).length <= 1 && !/you (may|might) have/i.test(a.content));
    const b = run(["can you explain burnout?"], mode, false).messages.at(-1)!;
    check(`${mode}: offers the related exercise`, b.meta?.techniqueOffered === "burnout", JSON.stringify(b.meta));
  }
  const v = run(["why can't I sleep at night?"], "voice", false).messages.at(-1)!;
  check("voice explanation stays speakable (no lists, under 70 words)", !/\n\d\.|\*\*/.test(v.content) && v.content.split(/\s+/).length < 70, v.content);
  check("feelings aren't treated as explanation requests", !extractFacts("I'm so tired today").asksExplanation);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
