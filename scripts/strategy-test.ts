/**
 * Strategy engine tests: which conversational move is planned for realistic moments.
 * Run: npm run test:strategy
 */
import { analyzeConversation } from "../src/lib/agent/state";
import { planTurn, type Move } from "../src/lib/agent/strategy";
import { assessRisk } from "../src/lib/safety/crisis";
import type { ChatMessage, MessageMeta } from "../src/lib/types";

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}${detail !== undefined ? `\n      → ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
};

let n = 0;
const A = (content: string, meta: MessageMeta = {}): ChatMessage => ({ id: `a${n++}`, role: "assistant", content, createdAt: 0, meta });
const U = (content: string): ChatMessage => ({ id: `u${n++}`, role: "user", content, createdAt: 0 });
const greet = () => A("Hi, I'm Ari, an AI companion. How's your day going so far?", { topic: "day", stage: "intro" });
const planFor = (history: ChatMessage[]) => {
  const last = history.at(-1)!.content;
  return planTurn(history, analyzeConversation(history), assessRisk(last).level, history.some((m) => m.meta?.safety === "crisis"));
};
const expectMove = (label: string, history: ChatMessage[], moves: Move[]) => {
  const p = planFor(history);
  check(`${label} → ${moves.join(" or ")}`, moves.includes(p.move), p.move);
  return p;
};

console.log("\n1. The reported transcript (stress + feeling ignored by wife)");
{
  const h = [greet(), U("good"), A("Glad to hear it! Anything in particular on your mind today?", { strategy: "casual" }), U("not feeling good stressed and not a having a good bond with wife too")];
  const p1 = expectMove("disclosure of stress and a strained marriage", h, ["reflect-explore"]);
  check("no question-free or advice move on first disclosure", p1.question === "required" && !/suggest|tips/i.test(p1.directive.split("No advice")[0]));
  h.push(A("That sounds like a lot at once. What's been happening between you two?", { strategy: "reflect-explore" }), U("wife"));
  expectMove("one-word follow-up on the topic", h, ["reflect-explore"]);
  h.push(A("Tell me a bit about how things have been with your wife.", { strategy: "reflect-explore" }), U("we didnt spend time together she wont mind me aswell"));
  const p3 = expectMove("feeling ignored (imperfect English)", h, ["reflect-explore"]);
  check("still exploring, not offering 'one small thing'", !/offer|ideas/i.test(p3.directive.split(".")[0]));
  h.push(A("It sounds like you feel ignored, like you don't matter to her. How long has it felt this way?", { strategy: "reflect-explore" }), U("since one year after our baby born"));
  expectMove("after three exploring turns (still listening)", h, ["reflect-explore", "reflect-only"]);
  h.push(A("That's a long time to feel alone in it.", { strategy: "reflect-only" }), U("yes it is hard"));
  expectMove("after four exploring turns", h, ["summarize"]);
  h.push(A("Let me check I've understood… Does that sound right?", { strategy: "summarize" }), U("yes exactly"));
  expectMove("after the summary", h, ["ask-permission"]);
  h.push(A("Would it help if I shared a couple of ideas, or keep talking it through?", { strategy: "ask-permission" }), U("yes please"));
  expectMove("agreed to hear ideas", h, ["advise-direct"]);
}

console.log("\n2. Other scenarios");
expectMove("happy small talk", [greet(), U("good"), A("Glad to hear that. Busy day or relaxed?", { strategy: "casual" }), U("busy with work, I'm a developer")], ["casual"]);
expectMove("wants practical help straight away", [greet(), U("skip the chat, I need practical tips for falling asleep")], ["advise-direct"]);
expectMove("asks what to do", [greet(), U("stressed"), A("That sounds heavy. What's going on?", { strategy: "reflect-explore" }), U("deadlines. what would you suggest?")], ["advise-direct"]);
expectMove("grief", [greet(), U("not great"), A("I'm sorry. Want to talk about it?", { strategy: "reflect-explore" }), U("my dog died yesterday")], ["comfort"]);
expectMove("declines to share", [greet(), U("fine"), A("Do you live with family or on your own? Only if you'd like to share.", { topic: "household", stage: "social", strategy: "casual" }), U("I'd rather not say")], ["respect-boundary"]);
expectMove("changes topic", [greet(), U("good"), A("Who's at home with you?", { topic: "household", strategy: "casual" }), U("actually can we talk about my exams instead?")], ["follow-lead"]);
expectMove("asks for an explanation", [greet(), U("why does anxiety make my chest tight?")], ["inform"]);
expectMove("accepts an offered exercise", [greet(), U("stressed"), A("Would you like to try a slow-breathing exercise?", { topic: "technique", techniqueOffered: "paced-breathing", strategy: "ask-permission" }), U("yes let's try")], ["guide"]);
expectMove("distress", [greet(), U("I don't see the point in trying anymore")], ["safety"]);
expectMove("after a crisis reply", [greet(), U("I want to die"), A("I'm really glad you told me… call or text 988…", { safety: "crisis" }), U("ok")], ["safety"]);
expectMove("goodbye", [greet(), U("good"), A("Glad to hear it. What's been on your mind?", { strategy: "casual" }), U("thanks, gotta go, bye")], ["close"]);
{
  const h = [greet(), U("ok"), A("Busy day or quiet one?", { strategy: "casual" }), U("fine"), A("What's been taking up your time?", { strategy: "casual" }), U("nothing")];
  const p = expectMove("one-word answers in a row", h, ["lower-pressure"]);
  check("low-pressure turns don't require a question", p.question !== "required");
}
{
  const h = [greet(), U("not great"), A("Sorry it's been hard. What's going on?", { strategy: "reflect-explore" }), U("everything at work"), A("That sounds like a lot. What's been the hardest part?", { strategy: "reflect-explore" }), U("idk"), A("That's okay. Is it more the workload or the people?", { strategy: "reflect-explore" }), U("both")];
  expectMove("short answers while things are hard", h, ["lower-pressure", "summarize"]);
}
{
  const long = "honestly it's like nobody at home even sees me anymore, I come back late and they've all eaten and gone to bed and I just sit there";
  const h = [greet(), U("not good"), A("I'm sorry. What's been going on?", { strategy: "reflect-explore" }), U("family stuff, I feel left out"), A("Feeling left out at home really hurts. What happens on a typical evening?", { strategy: "reflect-explore" }), U(long)];
  expectMove("long emotional disclosure after two questions", h, ["reflect-only", "summarize"]);
}

console.log("\n3. Research rules: repair, holding space, summaries, grief cues");
expectMove("'not really' after a reflection", [greet(), U("stressed"), A("It sounds like work is the main thing?", { strategy: "reflect-explore" }), U("not really, it's more my family")], ["repair"]);
expectMove("rupture: you're not listening", [greet(), U("stressed"), A("Have you tried a breathing exercise?", { strategy: "advise-direct" }), U("you're not listening to me")], ["repair"]);
{
  const h = [greet(), U("not good"), A("I'm sorry. What's been going on?", { strategy: "reflect-explore" }), U("my sister and I fell out"), A("That sounds painful. What happened between you?", { strategy: "reflect-explore" }), U("she said I never support her")];
  const p = expectMove("two question turns in a row while it's hard", h, ["reflect-only"]);
  check("holding space asks no question", p.question === "none");
}
{
  const h = [greet(), U("not good"), A("What's been going on?", { strategy: "reflect-explore" }), U("my sister and I fell out"), A("That sounds painful.", { strategy: "reflect-only" }), U("yeah"), A("What happened?", { strategy: "reflect-explore" }), U("she said I never support her")];
  expectMove("three exploring turns is not yet a summary", h, ["reflect-explore", "reflect-only", "lower-pressure"]);
}
check("grief wish to join someone → safety check", assessRisk("I just want to be with him again").level !== "none");
check("'see them again at Christmas' isn't flagged", assessRisk("can't wait to see them at Christmas").level === "none");

console.log("\n4. Regressions from the live scenario run");
expectMove("'kind of quiet' answers the greeting, not a repair", [greet(), U("kind of quiet")], ["casual", "lower-pressure", "reflect-explore"]);
expectMove("'not really' to a casual question isn't a repair", [greet(), U("good"), A("Busy day?", { strategy: "casual" }), U("not really, pretty calm")], ["casual", "lower-pressure"]);
expectMove("'what else?' after advice keeps advising, not guiding", [greet(), U("skip the chat, I need practical tips for falling asleep"), A("Try a steady wake-up time and a wind-down routine. Which fits?", { strategy: "advise-direct", topic: "technique" }), U("ok what else?")], ["advise-direct"]);

console.log(failures ? `\n${failures} strategy check(s) failed.` : "\nAll strategy checks passed.");
process.exit(failures ? 1 : 0);
