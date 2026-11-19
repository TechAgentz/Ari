/** Safety regression tests: crisis screening, history withholding, safety-check escalation, memory redaction. Run: npm run test:safety */
import { assessRisk } from "../src/lib/safety/crisis";
import { prepareTurn } from "../src/lib/agent/turn";
import { parseChatRequest } from "../src/lib/agent/protocol";
let bad = 0; const t = (l: string, ok: boolean, d = "") => { if (!ok) bad++; console.log(`${ok ? "✓" : "✗"} ${l} ${ok ? "" : d}`); };
for (const s of ["I'm going to hang myself", "i wanna die", "I have pills saved up and I'm going to end it tonight", "I just swallowed 40 sleeping pills", "kms", "I want to unalive myself", "I'm not suicidal but I want to kill myself tonight", "he raped me", "my boyfriend punched me"])
  t(`crisis: ${s}`, assessRisk(s).level === "crisis", assessRisk(s).level);
for (const s of ["my phone is going to die", "I want to take my life back", "I take my life one day at a time", "I'm reading about suicide prevention", "this traffic is killing me", "I don't see the point of this meeting"])
  t(`not crisis: ${s}`, assessRisk(s).level !== "crisis", assessRisk(s).level);
const P = { stage: "intro", answered: [], skipped: [], askedQuestionIds: [], stageQuestionCounts: { intro: 0, social: 0, lifestyle: 0, wellbeing: 0, support: 0 }, givenTechniques: [], userTurns: 2, userLed: false } as const;
const b = parseChatRequest({ mode: "chat", shareContext: false, progress: P, messages: [
  { role: "user", content: "I want to kill myself, I have the pills ready" },
  { role: "assistant", content: "I'm really glad you told me... call or text 988", meta: { safety: "crisis" } },
  { role: "user", content: "ok thanks, can we talk about something else" } ] })!;
const turn = prepareTurn(b);
const sent = JSON.stringify(turn.providerMessages);
t("crisis text stripped from provider history", !/kill myself|pills ready/.test(sent), sent.slice(0, 300));
t("priorCrisis still detected", turn.priorCrisis);
const b2 = parseChatRequest({ mode: "chat", shareContext: false, progress: P, messages: [
  { role: "user", content: "everything feels hopeless" },
  { role: "assistant", content: "That sounds incredibly hard. Are you having any thoughts of harming yourself?", meta: { safety: "distress", topic: "safety_check" } },
  { role: "user", content: "yes" } ] })!;
const t2 = prepareTurn(b2);
t("safety-check yes → crisis", t2.risk.level === "crisis", t2.risk.level);
const b3 = parseChatRequest({ mode: "chat", shareContext: false, progress: P, messages: [
  { role: "user", content: "everything feels hopeless" },
  { role: "assistant", content: "Are you having any thoughts of harming yourself?", meta: { safety: "distress", topic: "safety_check" } },
  { role: "user", content: "no, I'm safe" } ] })!;
t("safety-check no → not crisis", prepareTurn(b3).risk.level !== "crisis", prepareTurn(b3).risk.level);
const b4 = parseChatRequest({ mode: "chat", shareContext: true, progress: P, memory: { routine: "text my sister on 0412 345 678 and email sam.k@example.com", interests: [], feelings: [], concerns: [] }, messages: [{ role: "user", content: "hi" }] })!;
t("memory redacted", !/0412|example\.com/.test(JSON.stringify(b4.memory)), JSON.stringify(b4.memory));

console.log(bad ? `\n${bad} safety check(s) failed.` : "\nAll safety checks passed.");
process.exit(bad ? 1 : 0);
