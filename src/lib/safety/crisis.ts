import type { MessageMeta, SafetyCategory, SafetyLevel, TopicId } from "../types";

/**
 * Rule-based risk screening. Runs on-device before anything is sent anywhere,
 * and again on the server. High-risk messages are never sent to the AI provider,
 * on that turn or any later one; they receive a carefully written, deterministic
 * response with crisis resources.
 *
 * This is a demo safeguard, not a clinical risk assessment.
 */

// ───────────────────────── Normalisation ─────────────────────────

/** Contractions are expanded so each pattern only needs one spelling ("don't" → "do not", "I'm" → "i am"). */
const CONTRACTIONS: [RegExp, string][] = [
  [/\b(?:can'?t|cannot)\b/g, "can not"],
  [/\bwon'?t\b/g, "will not"],
  [/\bain'?t\b/g, "is not"],
  [/n't\b/g, " not"],
  [/\b(do|does|did|is|was|were|are|have|has|had|would|could|should|must|need)nt\b/g, "$1 not"],
  [/\bi'?m\b/g, "i am"],
  [/\bi'?ve\b/g, "i have"],
  [/\bi'd\b/g, "i would"],
  [/\b(he|she|they|you|we|it)'d\b/g, "$1 would"],
  [/'ll\b/g, " will"],
  [/'re\b/g, " are"],
  [/\b(he|she|it|that|there|what|who|where|life|everything|nothing|this)'s\b/g, "$1 is"],
  [/\bwhats\b/g, "what is"],
];

function normalize(input: string): string {
  let text = input
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")
    .replace(/[’‘`´ʼ]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, " ").trim();
}

/** Removes every match of `patterns` (replaced by a separator so words don't join up). */
function strip(text: string, patterns: RegExp[]): { text: string; hit: boolean } {
  let hit = false;
  let out = text;
  for (const pattern of patterns) {
    out = out.replace(pattern, () => {
      hit = true;
      return " | ";
    });
  }
  return { text: out, hit };
}

// ───────────────────────── Patterns (on normalised text) ─────────────────────────

/** Everyday idioms and unrelated compounds that only look like risk. Removed before screening. */
const IDIOMS: RegExp[] = [
  /\b(?:going to|gonna) die (?:if|of|from|laughing|waiting|before|when) (?:this|that|the|my|i|we|it|they|he|she)\b/g,
  /\b(?:take|taking|took|takes) (?:back )?my (?:own )?life (?:back|one day|day by day|a day at a time|in (?:a|my|the|new|another|hand|hands|stride)\b|into (?:my|our) (?:own )?hands|to (?:the|a|new|another)\b|(?:more |less |too )?seriously|for granted|step by step|forward|apart|as it comes|easy|slow|off (?:hold|pause)|over\b)/g,
  /\b(?:die|died|dying) (?:of|from) (?:embarrassment|boredom|laughter|laughing|cuteness|hunger|heat|shame|exhaustion|thirst|curiosity|suspense|jealousy|envy|fomo|cringe|happiness|old age|natural causes)\b/g,
  /\b(?:die|dying) (?:laughing|on (?:this|that) hill|trying)\b/g,
  /\b(?:to )?die for\b/g,
  /\bdie (?:my|your|his|her|their|the) (?:hair|clothes|shirt|beard|eyebrows|jeans|shoes|dress)\b/g,
  /\b(?:kill|killed|killing) myself (?:laughing|with laughter)\b/g,
  /\b(?:shoot|shooting|shot|shoots) myself in the foot\b/g,
  /\b(?:drown|drowning|drowned) myself in (?:work|coffee|tea|homework|books|studies|assignments|tasks|chores|paperwork|music|tv|netflix|series|games|video games)\b/g,
  /\bsuicid(?:e|al) (?:squad|bombers?|bombings?|doors?|missions?|runs?|king|blonde|rates?|statistics|stats|forest|song)\b/g,
  /\boverdos(?:e|ed|es|ing) on (?:coffee|caffeine|sugar|chocolate|candy|sweets|carbs|netflix|tv|tiktok|social media|work|cuteness|love|kindness|vitamin c)\b/g,
  /\b(?:hurt|cut|burnt|burned|burn) myself (?:shaving|cooking|chopping|slicing|by accident|accidentally|at the gym|at work|playing|lifting|running|exercising|working out|on the (?:stove|oven|pan|kettle|iron)|while)\b/g,
  /\b(?:hit|hits|hitting) me up\b/g,
  /\b(?:hit|hits|threw|throws) me with (?:a |her |his |their )?(?:pillow|cushion|snowball|water balloon|nerf|question|compliment|joke)\b/g,
  /\brather die than (?:eat|wear|watch|sit through|be seen|listen to|admit|apologi[sz]e|ask|talk to|call|text|attend|go to (?:that|this|the|a|another|work|school|class)|do (?:that|this|it|my|homework|chores))\b/g,
  // Someone else ("nobody wants to die", "they want to die") — the first-person forms are screened below.
  /\b(?:he|she|they|it|who|nobody|people|everyone|everybody|anyone|anybody|someone|somebody|no one)(?: [a-z]+)? (?:wanna|want to|wants to) die\b/g,
];

/**
 * Negated risk ("I'm not suicidal", "I'd never hurt myself", "I don't want to die") and panic
 * sensations. Only the matched span is removed, so "I'm not suicidal but I want to kill myself"
 * is still a crisis; when nothing else remains the message is treated as distress.
 */
const SOFTENED: RegExp[] = [
  /\b(?:not|never|no longer|no)(?: (?:really|actually|at all|even|feeling|being|been|currently|ever|that|very))* suicidal\b/g,
  /\b(?:not|never|no longer)(?: (?:ever|really|actually|even|seriously))* (?:(?:going to|gonna|planning to|plan to|want to|wanna|trying to|about to|intending to|ever going to|actually going to|thinking about|thinking of|think about|think of|thought about|thought of|considering|considered) )?(?:kill|killing|hurt|hurting|harm|harming|cut|cutting|end|ending|take|taking) (?:myself|my (?:own )?life)\b/g,
  /\b(?:not|never|no longer)(?: (?:ever|really|actually|even|seriously|been))* (?:thinking|thought|think) (?:about|of) (?:suicide|killing myself|ending (?:it|my life)|hurting myself|harming myself|self[- ]?harm(?:ing)?)\b/g,
  /\bno (?:suicidal )?(?:thoughts|plans?|intentions?|intent|urges?|desire) (?:of|about|to) (?:suicide|kill(?:ing)? myself|end(?:ing)? (?:it|my life)|hurt(?:ing)? myself|harm(?:ing)? myself|self[- ]?harm|die|dying)\b/g,
  /\b(?:no|not (?:having|had|have|got)(?: any)?|never (?:had|have)(?: any)?|do not have(?: any)?) suicidal (?:thoughts|feelings|ideation|urges|plans|intent)\b/g,
  /\b(?:not|never|no longer) (?:want|wanna|wanted|wish|going|gonna|planning|plan|trying|ready) (?:to )?die\b/g,
  /\b(?:feel|felt|feels|feeling) like i (?:am |was )?(?:going to|gonna|about to) die\b/g,
  /\bthought i (?:was going to|was gonna|would|might) die\b/g,
];

/** Words that may sit between "I" and a verb: "I really just want to…", "I am so ready to…". */
const ADVERBS =
  "am|was|would|will|have|had|do|did|just|really|honestly|actually|literally|seriously|sometimes|kinda|kind of|sort of|still|truly|so|always|often|even|also|almost|only|probably|definitely|genuinely|completely|totally|simply|basically|lowkey|deeply|desperately|secretly|feel like|think|now|already|finally|been|fully";

const CRISIS_PATTERNS: Record<SafetyCategory, RegExp[]> = {
  suicide: [
    /\b(?:kill|killing|killed|end|ending|ended|take|taking|took) (?:myself|my (?:own )?life)\b/,
    // First person only: "my phone is going to die" is not a crisis.
    new RegExp(
      String.raw`\bi(?: (?:${ADVERBS}))* (?:want|wanna|wanted|wish|wishing|going|gonna|plan|planning|planned|ready|deserve|deserved|need|needed|about|trying|hope|hoping|decided|deciding|like|rather|longing|have) (?:to )?(?:fucking |freaking |just |simply |finally )?die\b`,
    ),
    // "wanna die", "makes me want to die" (other people's wishes are removed as idioms above).
    /\b(?:wanna|want to|wanting to|wish to) (?:fucking |freaking |just )?die\b/,
    /(?:^|[.!?] ?)(?:(?:just|really|honestly|seriously|literally|lowkey|so|kinda|probably) )*(?:going to|gonna) (?:fucking |freaking |just )?die\b/,
    /\b(?:sleep|asleep|bed|sleeping) and (?:just )?(?:never|not) wake up\b|\bnever wake up again\b|\b(?:want|wanna|wish|like) (?:to )?(?:just )?(?:never|not) wake up\b/,
    /\bwish(?:ing)? (?:that )?i (?:was|were|could be|would be|could|would|might|had) (?:just )?(?:dead|die|died|never been born|never born|not alive)\b/,
    /\b(?:hope|hoping|pray|praying) (?:that )?i (?:die|just die|do not wake up|never wake up|will not wake up|get hit|get killed|get run over)\b/,
    /\b(?:wish|hope|pray)(?:ing)? (?:that )?(?:a|the|some|someone|somebody|something)(?: [a-z]+)? (?:would|could|will|to) (?:just )?(?:hit|kill|run over|shoot) me\b/,
    /\b(?:want|wanna|wish|rather|ready|like|prefer|deserve) (?:to )?(?:just )?be dead\b/,
    /\b(?:do not|did not|no longer|never) (?:want|wanna|wish|wanted) (?:to )?(?:live|be alive|exist|wake up|be here any ?more|be here at all|be on this (?:earth|planet)|keep living|go on living|carry on living)\b(?! (?:in|with|at|near|there|here|abroad|alone|together|on|by|next|close|far|somewhere|anywhere|early|before|so|for|this|that|until|tomorrow at))/,
    /\bbetter off (?:dead|without me|(?:if|when) i(?: am| was| were| had)?(?: just)? (?:gone|dead|died|disappeared|not (?:here|around|alive)))\b/,
    /\b(?:miss|notice|care|matter)(?: about)? (?:me )?(?:if|when) i(?: am| was| were| had)?(?: just)? (?:gone|dead|died|die|disappeared|killed myself|not (?:here|around|alive))\b/,
    /\b(?:no|any|nothing|without a|lost (?:my|all)) (?:reason|point|purpose) (?:to|in|for) (?:live|living|go on|going on|keep going|keep living|carry on|carrying on|be alive|being alive|stay alive|staying alive)\b/,
    /\bnothing (?:left )?to live for\b/,
    /\bnot worth (?:living|being alive)\b|\blife (?:is|feels|seems) (?:just |really |honestly )?(?:not|no longer|never) worth it\b/,
    /\bend(?:ing)? (?:it (?:all|tonight|today|now|soon|tomorrow|this (?:week|weekend|time)|for good|once and for all)|everything)\b/,
    /(?:^|[^0-9 ]) ?\bkms\b|\b(?:unalive|unaliving|unalived|sewer ?slide)\b/,
    /\boff(?:ing)? myself\b/,
    /\b(?:hang|hanging|hanged|hung|drown|drowning|drowned|shoot|shooting|stab|stabbing|suffocate|suffocating|poison|poisoning|electrocute|electrocuting|gas|gassing|strangle|strangling|smother|smothering) myself\b/,
    /\b(?:slit|slitting|slash|slashing|cut|cutting) (?:my|both) (?:wrists?|throat|veins)\b/,
    /\b(?:jump|jumping|leap|leaping|throw myself|throwing myself) (?:off|from) (?:a|the|my|this|that|our|some)(?: [a-z0-9]+)? (?:bridge|building|roof|rooftop|cliff|balcony|tower|ledge|window|overpass|car park|parking (?:garage|structure|lot)|skyscraper|flat|apartment|storey|story|floor)\b/,
    /\b(?:jump|jumping|step|stepping|throw myself|throwing myself|lie down|lying down|walk|walking) in front of (?:a|the|an|some|oncoming)(?: [a-z]+)? (?:train|bus|car|truck|lorry|tram|traffic|subway|metro)\b/,
    // Means and plans.
    /\b(?:pills|tablets|meds|medication|painkillers) (?:saved|stockpiled|stashed|hoarded|ready|lined up|counted out|set aside)\b/,
    /\b(?:saved|saving|stockpiled|stockpiling|hoarded|hoarding|stashed|stashing|collected|collecting|counted out) (?:up )?(?:(?:all|some|enough|a lot) (?:of )?)?(?:(?:my|the|these|those|her|his|mum's|mom's|dad's) )?(?:sleeping |pain ?|antidepressant )?(?:pills|tablets|meds|medication|painkillers)\b/,
    /\benough (?:pills|tablets|meds|painkillers|medication) to (?:kill|end|die|overdose|do it|not wake up|never wake up|sleep forever)\b/,
    /\b(?:have|got|bought|buy|buying|get|getting|found|own|keep|kept|grab|grabbed|took|loaded|load|holding|hold) (?:a|my|the|dad's|my dad's|his|her|a loaded) (?:gun|rope|firearm|pistol|rifle|shotgun|revolver)\b(?! (?:licen[cs]e|permit|range|club|show|safe|safety|course|lesson|class|collection|swing|ladder|bridge|toy))/,
    /\b(?:tie|tied|tying|made|make|making|bought|have|got) (?:a|the) noose\b/,
    /\buse (?:it|them|this|that|the gun|a gun|the rope|the pills) on myself\b/,
    // "Suicide" with first-person or intent context (a bare mention is distress, see below).
    /\b(?:i am|i feel|i felt|i have been|i was|i get|i got|feeling|felt|been|getting|became|become|becoming) (?:(?:really|so|very|extremely|pretty|quite|kind of|kinda|a bit|a little|more|super|seriously|actually|honestly|incredibly|increasingly) )*suicidal\b/,
    /\bsuicidal (?:thoughts|feelings|ideation|urges|again|lately|right now|tonight|today|thinking|plans?)\b/,
    /\b(?:commit|committing|committed|attempt|attempting|attempted|consider|considering|considered|contemplate|contemplating|contemplated|plan|planning|planned|think about|thinking about|thought about|think of|thinking of|thought of) (?:committing )?suicide\b/,
    /\bsuicide (?:note|plan|attempt|pact|letter|method)s?\b/,
    /\bsuicide (?:is|seems|feels|looks|sounds) (?:like )?(?:the |my )?(?:only|best|easiest|last|right|real|answer|way out|option)\b/,
    /\bsuicide\b.{0,30}\b(?:crossed|crossing|crosses|on) my mind\b/,
    /\bmy suicide\b/,
    /^\W*(?:suicidal|suicide|i am suicidal|feeling suicidal)\W*$/,
  ],
  "self-harm": [
    /\b(?:hurt|hurting|harm|harming|cut|cutting|burn|burning|scratch|scratching) myself\b/,
    /\b(?:i|i am|i have been|i was|been|started|start|keep|kept|back to|urges? to|want to|wanna|thinking about|thought about|think about|can not stop|relapsed into) (?:[a-z]+ )?self[- ]?harm(?:ing|ed)?\b|\bmy self[- ]?harm\b|\bself[- ]?harm(?:ing|ed)? again\b/,
    /\b(?:i|i am|i will|i might|i could|want to|wanna|going to|gonna|plan to|planning to|thinking about|thinking of|thought about|think about|urge to|tempted to) (?:[a-z]+ )?overdos(?:e|ing)\b/,
    /\b(?:cutting|burning|harming|hurting|scratching) (?:myself )?again\b/,
    /\b(?:been|started|start|starting|keep|kept|can not stop|back to|relapsed into|urge to|urges to) (?:cutting|self[- ]?harming|harming myself|hurting myself|burning myself|cut|burn)\b(?! (?:back|down|out|off|up|in|through|across|costs|corners|ties|class|classes|carbs|sugar|calories|hair|the|a|an|my|it|them|that|this|wood|paper|vegetables|onions|meat|bread|grass|some|things|people|someone|him|her))/,
    /\b(?:cutting|scratching|carving|burning) (?:my|both) (?:arms?|wrists?|legs?|thighs?|skin|stomach|body|hips?)\b/,
  ],
  "harm-others": [
    /\b(?:want|going|gonna|plan|planning|about) to (?:kill|hurt|harm|attack|stab|shoot) (?:him|her|them|someone|somebody|people|everyone|everybody)\b/,
    /\bi (?:am|will)(?: [a-z]+)? (?:kill|hurt|harm|stab|shoot) (?:him|her|them|someone|somebody)\b/,
  ],
  abuse: [
    /\b(?:he|she|they|someone|somebody|my (?:partner|husband|wife|boyfriend|girlfriend|bf|gf|ex|dad|father|mom|mum|mother|parent|parents|stepdad|stepfather|stepmom|stepmum|stepmother|brother|sister|uncle|aunt|cousin|grandfather|grandpa|grandmother|grandma|boss|coach|teacher|fiance|fiancé|fiancee|spouse|roommate|flatmate|housemate|carer|caregiver|family|son|daughter))(?: [a-z]+)? (?:hits|hit|beats|beat|kicks|kicked|punches|punched|slaps|slapped|chokes|choked|strangles|strangled|threatens|threatened|hurts|abuses|abused|rapes|raped|molests|molested|assaults|assaulted|attacks|attacked|shoves|shoved|burns|burned|burnt|whips|whipped|smacks|smacked|stabbed|throttled) me\b(?! (?:out|off|at|to it|in (?:a|the) (?:race|game|match))\b)/,
    /\b(?:being|been|was|were|got|get|getting) (?:abused|hit|beaten|beaten up|raped|molested|sexually (?:assaulted|abused)|assaulted|strangled|choked|groped|attacked|stabbed)\b(?! (?:up|by (?:a|the) (?:ball|car|bus|wave|truck|bike))\b)/,
    /\b(?:raped|molested|sexually (?:assaulted|abused))\b|\b(?:survivor of|victim of|experienced|suffered|went through|going through) (?:sexual (?:assault|abuse)|rape|abuse|domestic (?:abuse|violence))\b/,
    /\b(?:rape|raping|rapes|molest|molesting|molests|abuse|abusing|abuses) me\b/,
    /\b(?:not|do not feel|never feel) safe (?:at home|with (?:him|her|them|my (?:partner|husband|wife|boyfriend|girlfriend|dad|mom|mum|parents|family)))\b/,
    /\b(?:afraid|scared) for my (?:life|safety)\b/,
    /\b(?:scared|afraid|terrified|frightened|worried|fear|fearing) (?:that )?(?:he|she|they|my [a-z]+) (?:will|is going to|is gonna|might|could|would|are going to) (?:really |actually )?(?:kill|hurt|beat|hit|attack|stab|shoot|strangle|choke|rape) me\b/,
    /\b(?:threatened|threatens|threatening) to (?:kill|hurt|beat|stab|shoot|attack) (?:me|my)\b/,
  ],
  medical: [
    /\b(?:took|swallowed|taken|downed|popped|ingested|overdosed on|od on)(?: (?:like|about|around|maybe|over|nearly|almost|just|literally))* (?:too many|a lot of|lots of|loads of|a load of|tons of|a ton of|a bunch of|a handful of|handfuls of|a fistful of|heaps of|a heap of|a pile of|a mouthful of|all (?:of )?(?:my|the|his|her|their|mum's|mom's|dad's|grandma's)|every (?:single )?one of (?:my|the)|dozens of|a dozen|(?:an? )?(?:whole |entire |full |half (?:a |of )?(?:the )?)?(?:bottle|box|packet|pack|strip|jar|tub|sheet|blister pack)s? of|(?:1\d|[2-9]\d|\d{3,})(?! ?(?:mg|mcg|ml|milligrams?|micrograms?|g|grams?|units?|iu|%|percent|minutes?|mins?|hours?|hrs?|days?|weeks?|years?|times?)\b)|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a hundred)(?: [a-z0-9'-]+){0,3}? (?:pills|tablets|meds|medication|medications|medicine|painkillers|paracetamol|tylenol|acetaminophen|ibuprofen|advil|aspirin|sleeping pills|sleeping tablets|antidepressants|xanax|valium|benzos|opioids|oxy|oxycodone|codeine|insulin|capsules|caplets|lithium)\b/,
    /\bi (?:just |have |have just |had )?overdosed\b/,
  ],
};

const DISTRESS_PATTERNS: RegExp[] = [
  // Grief-related wish to join someone who died (research rule 31): ask directly about safety.
  /\b(want|wanna|wish i could|long) to (be with|join|see) (him|her|them|my (mum|mom|dad|husband|wife|partner|son|daughter|brother|sister|friend|baby)) again\b/,
  /\b(go|be) where (he|she|they) (is|are|went)\b/,
  /\bhopeless\b/,
  /\bcan not (?:go on|cope|take (?:it|this|much more)(?: any ?more)?|do this any ?more|keep going|handle (?:it|this|life) any ?more)\b/,
  /\b(?:falling|fall) apart\b/,
  /\bbreaking down\b/,
  /\bpanic attack/,
  /\b(?:no one|nobody|no-one|noone) (?:cares|would care|would notice|would even notice|would miss me|would even miss me|will miss me|cares about me|loves me)\b/,
  /\bworthless\b/,
  /\bi give up\b/,
  /\btrapped\b/,
  /\bdisappear\b/,
  /\bunbearable\b/,
  // Hopelessness / loss of meaning — common indirect warning signs.
  /\b(?:do not|can not) (?:really |even |honestly )?see (?:the|any) point (?:in (?:trying|living|anything|going on|carrying on|it all)|of (?:living|life|anything|it all|trying|going on)|any ?more)\b/,
  /\bwhat is the point (?:of (?:living|life|anything|it all|trying|going on|any of (?:it|this))|in (?:trying|living|anything)|any ?more)\b/,
  /\bno point (?:in )?(?:trying|anything|any of (?:it|this)|going on|carrying on)\b/,
  /\bnothing (?:i do )?matters(?: any ?more)?\b/,
  /\b(?:i am|feel like) (?:just )?a burden\b/,
  /\b(?:tired|sick) of (?:living|life|being alive|everything)\b/,
  /\bgive up on (?:everything|life)\b/,
  /\b(?:do not|did not) want to be here\b(?! (?:at|in|for|with|on|during)\b)/,
  /\b(?:want|wanna|going|gonna|planning|ready|need|have) to end it\b(?! (?:with|between)\b)/,
  /\b(?:better|happier) without me\b/,
  /\b(?:end|stop) the pain\b/,
  /\bstarv(?:e|ing) myself\b/,
  /\bnot worth it any ?more\b/,
  /\bdark thoughts\b/,
  /\bsleep forever\b/,
  /\bthoughts of (?:death|dying)\b/,
  // A bare mention ("suicide prevention", "my friend self-harms"): check in gently.
  /\bsuicid|\bself[- ]?harm|\boverdos/,
];

export interface RiskAssessment {
  level: SafetyLevel;
  categories: SafetyCategory[];
}

const NONE: RiskAssessment = { level: "none", categories: [] };
const DISTRESS: RiskAssessment = { level: "distress", categories: [] };

export function assessRisk(input: string): RiskAssessment {
  const { text } = strip(normalize(input), IDIOMS);
  const softened = strip(text, SOFTENED);
  const categories = (Object.keys(CRISIS_PATTERNS) as SafetyCategory[]).filter((c) => CRISIS_PATTERNS[c].some((p) => p.test(softened.text)));
  if (categories.length > 0) return { level: "crisis", categories };
  // "I'm not suicidal, just tired" → distress: still check in gently.
  if (softened.hit || DISTRESS_PATTERNS.some((p) => p.test(softened.text))) return { ...DISTRESS };
  return { ...NONE };
}

// ───────────────────────── Context: safety checks and later turns ─────────────────────────

/** The fields screening needs from a chat or request message. */
export interface ScreenedMessage {
  role: "user" | "assistant";
  content: string;
  meta?: { safety?: SafetyLevel; topic?: TopicId };
}

/**
 * Stand-ins for withheld messages. They keep the conversation's shape for the AI
 * provider without any of the content; the server also reads them as a prior crisis.
 */
export const WITHHELD = {
  user: "[Message withheld for the user's safety and privacy]",
  assistant: "[Ari shared crisis line details here and asked whether they are safe and able to reach out to someone]",
} as const;

const HARM_QUESTION =
  /\b(?:harm|harming|hurt|hurting|kill|killing|injure|injuring|end|ending) (?:yourself|your ?self|themselves|your (?:own )?life|their (?:own )?life)\b|\bsuicid|\bself[- ]?harm|\b(?:wanting|want) to (?:be here|be alive|live|die|go on|wake up)\b|\bthoughts? of (?:death|dying|not being here)\b|\bending (?:it|things)\b/;
const LIKE_THAT_QUESTION =
  /\b(?:thoughts?|feelings?|anything|something|any of (?:that|this)) like (?:that|this)\b|\b(?:is|are) (?:that|any of that|anything like that) (?:going on|happening|true|the case|something)\b|\b(?:going on|happening) for you\b|\bhave you (?:had|been having|ever had) (?:those|these|them|any)\b|\bare you having (?:those|these|them|any)\b|\bdo you (?:have|get|ever have) (?:those|these|them|thoughts|any)\b/;
const SAFE_QUESTION = /\b(?:are you|do you feel|you feel|feeling) (?:feeling |somewhere |in a )?safe\b|\bsomewhere safe\b|\bin (?:a )?safe place\b|\bkeep(?:ing)? yourself safe\b|\bin (?:any )?(?:immediate )?danger\b/;
const ABUSE_CONTEXT = /\b(?:at home|with (?:him|her|them)|partner|relationship|husband|wife|boyfriend|girlfriend|family|parents?|where you live)\b/;

/** What a safety check asked about: thoughts of self-harm ("harm") or being safe ("safe"). */
export function safetyCheckKind(message: ScreenedMessage): "harm" | "safe" | undefined {
  if (message.role !== "assistant" || message.meta?.safety === "crisis") return undefined;
  const text = normalize(message.content);
  const questions = text.match(/[^.!?]*\?/g);
  const question = questions ? questions[questions.length - 1] : "";
  if (question && HARM_QUESTION.test(question)) return "harm";
  if (question && SAFE_QUESTION.test(question)) return "safe";
  // "Some people have thoughts of harming themselves… Is anything like that going on for you?"
  if (message.meta?.topic === "safety_check" || (question && LIKE_THAT_QUESTION.test(question) && HARM_QUESTION.test(text))) return "harm";
  return undefined;
}

const FILLER = /^(?:(?:um+|uh+|erm+|hmm+|well|honestly|actually|i mean|to be honest|tbh|so|oh)[\s,.!-]+)+/;
const DENIAL =
  /^(?:no(?! idea)|nope|nah|not really|not at all|not right now|not any ?more|never|no way|definitely not|absolutely not|of course not|god no|nothing like that|i do not think so|i am (?:safe|ok|okay|fine|good|alright|all right))\b/;
const YES_START =
  /^(?:yes|yeah|yep|yup|yea|ya|yah|aye|definitely|of course|absolutely|sometimes|maybe|probably|perhaps|possibly|i guess|i think so|i suppose|kind of|kinda|sort of|sorta|a bit|a little|a few times|once or twice|a couple of times)\b|^(?:i am|i do|i have)(?:[.!,]|$)/;
const YES_ANYWHERE =
  /\b(?:yes|yeah|yep|yup|sometimes|i do not know(?! (?:why|what|how|where|when|who)\b)|idk|not sure|unsure|no idea|crossed my mind|on my mind|(?:thought|think|thinking) about (?:it|that|this|them)|having them|had them|i might)\b/;
const WEAK_YES = /^(?:ok|okay|sure|alright|all right|true|correct|right)\b/;
const SAFE_STATEMENT = /\b(?:i am|i feel|feeling|i will be) (?:totally |completely |perfectly |pretty |quite |really |actually |definitely )?(?:safe|ok|okay|fine|alright|all right|good)\b/;
const NOT_SAFE = /\bnot (?:really |entirely |completely |totally |very |feel |feeling |always )*safe\b|\bunsafe\b|\bin danger\b|\bscared for my (?:life|safety)\b/;

/** How a reply to a safety check reads: "risk" (escalate), "safe" (a clear no) or "unclear". */
export function readSafetyAnswer(kind: "harm" | "safe", reply: string): "risk" | "safe" | "unclear" {
  const text = normalize(reply).replace(FILLER, "");
  if (kind === "safe") {
    if (NOT_SAFE.test(text)) return "risk";
    if (SAFE_STATEMENT.test(text) || /^(?:yes|yeah|yep|yup|ya|i am|i think so|of course|definitely|totally|for now|mostly)\b/.test(text)) return "safe";
    if (/^(?:no|nope|nah|not really|not sure|i am not sure|i do not know|idk|no idea|maybe|kind of|kinda|sort of|i do not think so|not at all|not right now|not exactly|hardly|not completely|not entirely)\b/.test(text)) return "risk";
    return "unclear";
  }
  if (DENIAL.test(text)) {
    // "No, I'm safe" stays a no; "not really, but sometimes…" doesn't.
    const turn = text.replace(DENIAL, "").match(/\b(?:but|though|although|except|yet|well|actually)\b[\s,.!-]*(.*)$/);
    return turn && (YES_START.test(turn[1]) || YES_ANYWHERE.test(turn[1])) ? "risk" : "safe";
  }
  if (YES_START.test(text) || YES_ANYWHERE.test(text)) return "risk";
  // "Okay, I'm fine" reads as a no; a bare "ok" or "sure" as a yes.
  if (WEAK_YES.test(text)) return SAFE_STATEMENT.test(text) ? "safe" : "risk";
  return "unclear";
}

/** Risk of the user message at `index`, read together with the safety check it may be answering. */
function riskInContext(messages: readonly ScreenedMessage[], index: number): RiskAssessment {
  const message = messages[index];
  if (message.content.trim() === WITHHELD.user) return { level: "crisis", categories: [] };
  const risk = assessRisk(message.content);
  if (risk.level === "crisis") return risk;
  let prev = index - 1;
  while (prev >= 0 && messages[prev].role !== "assistant") prev--;
  const kind = prev >= 0 ? safetyCheckKind(messages[prev]) : undefined;
  if (!kind) return risk;
  const answer = readSafetyAnswer(kind, message.content);
  if (answer === "risk") {
    const abuse = kind === "safe" && ABUSE_CONTEXT.test(normalize(messages[prev].content));
    return { level: "crisis", categories: [abuse ? "abuse" : "suicide"] };
  }
  // A reply that doesn't clearly answer the check keeps safety in focus.
  return answer === "unclear" ? { ...DISTRESS } : risk;
}

/**
 * Risk of the latest user message in context: a "yes" to a safety check ("are you
 * having thoughts of harming yourself?") is a crisis, exactly like a direct disclosure.
 */
export function assessTurnRisk(messages: readonly ScreenedMessage[]): RiskAssessment {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return riskInContext(messages, i);
  return { ...NONE };
}

/**
 * Flags the messages that must never reach the AI provider: crisis disclosures
 * (re-screened every time, so it doesn't depend on stored meta), risky answers
 * to a safety check, the crisis replies, and the message each reply answered.
 */
export function crisisFlags(messages: readonly ScreenedMessage[]): boolean[] {
  const flags = messages.map(() => false);
  messages.forEach((message, i) => {
    if (message.role === "user") {
      if (riskInContext(messages, i).level === "crisis") flags[i] = true;
    } else if (message.meta?.safety === "crisis" || message.content.trim() === WITHHELD.assistant) {
      flags[i] = true;
      if (messages[i - 1]?.role === "user") flags[i - 1] = true;
    }
  });
  return flags;
}

/** Replaces withheld messages (see `crisisFlags`) with neutral placeholders; meta is kept. */
export function withholdCrisisMessages<T extends ScreenedMessage>(messages: readonly T[]): T[] {
  const flags = crisisFlags(messages);
  return messages.map((m, i) => (flags[i] ? { ...m, content: WITHHELD[m.role] } : m));
}

// ───────────────────────── Responses ─────────────────────────

/** Deterministic, carefully worded response for high-risk messages. */
export function crisisResponse(categories: SafetyCategory[], mode: "chat" | "voice"): string {
  const voice = mode === "voice";
  if (categories.includes("medical")) {
    return voice
      ? "This sounds like it could be a medical emergency. Please call your local emergency number right now, like 911, 999 or 112, or ask someone nearby to help you. I'm a virtual assistant and can't call for you, but I'm here while you get help."
      : "This sounds like it could be a medical emergency. **Please call your local emergency number right now** (911 in the US/Canada, 999 in the UK, 112 in the EU, 000 in Australia), or ask someone nearby to call for you.\n\nI'm an AI, so I can't contact anyone for you — but I'm here while you get help. Are you able to call now?";
  }
  if (categories.includes("abuse")) {
    return voice
      ? "Thank you for telling me. What's happening to you is not okay, and it's not your fault. Your safety matters most. If you're in danger right now, please call your local emergency number. I've put some confidential helplines on the screen. Are you somewhere safe at the moment?"
      : "Thank you for trusting me with this. What's happening to you is not okay, and it's not your fault.\n\nYour safety matters most. **If you're in danger right now, please call your local emergency number.** Confidential support is available any time — in the US, the National Domestic Violence Hotline (1-800-799-7233, or text START to 88788); in the UK, the National Domestic Abuse Helpline (0808 2000 247). More options are listed below.\n\nAre you somewhere safe at the moment?";
  }
  if (categories.includes("harm-others")) {
    return voice
      ? "It sounds like you're carrying a lot of intense feelings right now. If you feel you might hurt someone, please step away to somewhere safe and call your local emergency number or a crisis line — in the US or Canada you can call or text 988. Would you be willing to do that?"
      : "It sounds like you're dealing with some really intense feelings right now, and I'm glad you said something.\n\nIf you feel you might act on thoughts of hurting someone, **please put some distance between you and them and contact your local emergency number or a crisis line now** — in the US or Canada you can call or text **988**; in the UK and Ireland, Samaritans are on **116 123**. They can help you through this moment.\n\nWould you be willing to reach out to one of them right now?";
  }
  return voice
    ? "I'm really glad you told me, and I'm so sorry you're in this much pain. I'm a virtual assistant, so I can't give you the support you deserve right now, but people at a crisis line can, any time. In the US or Canada you can call or text 988. In the UK or Ireland, call Samaritans on 116 123. If you're in immediate danger, please call your local emergency number. I've put more options on the screen. Would you be willing to reach out to one of them now?"
    : "I'm really glad you told me, and I'm so sorry you're carrying this much pain right now. You deserve support from a real person in this moment.\n\nI'm a virtual assistant, so I can't give you the help you need right now — but trained people at a crisis line can, any time, day or night:\n\n- **US & Canada:** call or text **988**\n- **UK & Ireland:** Samaritans, **116 123** (free, 24/7)\n- **Anywhere else:** findahelpline.com lists free, confidential services in your country\n\n**If you're in immediate danger, please call your local emergency number** (911, 999, 112, 000).\n\nWould you be willing to reach out to one of them — or to someone you trust nearby — right now? I'm still here with you.";
}

/** The deterministic crisis reply with its message meta (the same on the device and on the server). */
export function crisisReply(categories: SafetyCategory[], mode: "chat" | "voice"): { text: string; meta: MessageMeta } {
  return { text: crisisResponse(categories, mode), meta: { provider: "safety", stage: "support", safety: "crisis", safetyCategories: categories } };
}

/** Extra guidance appended to the LLM system prompt when distress is detected. */
export const DISTRESS_PROMPT =
  "SAFETY NOTE: The user's latest message suggests significant distress. Your reply MUST, in this order: (1) validate warmly in one sentence; (2) say in one short sentence that a crisis line can talk with them any time, day or night; (3) end with one direct, gentle question asking whether they're having thoughts of harming themselves or not wanting to be here. No techniques or other questions until they've answered.";
