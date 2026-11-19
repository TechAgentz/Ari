/**
 * Hardcoded psychology knowledge base (educational, non-diagnostic).
 * Content summarises widely accepted, evidence-informed self-help guidance
 * from public health bodies (NHS, NIMH, WHO, APA, CDC). It is general
 * information only and never a substitute for professional care.
 */

export type KnowledgeCategory =
  | "Stress & Anxiety"
  | "Mood & Emotions"
  | "Sleep & Energy"
  | "Relationships"
  | "Thinking Patterns"
  | "Skills & Practices"
  | "Getting Support";

export interface Technique {
  name: string;
  duration: string;
  steps: string[];
  /** Short, speakable version for voice conversations. */
  voiceScript: string;
  /** Renders an animated breathing pacer on the library page. */
  pacer?: { inhale: number; hold?: number; exhale: number; holdAfter?: number };
}

export interface KnowledgeEntry {
  slug: string;
  title: string;
  category: KnowledgeCategory;
  summary: string;
  /** Phrases used for retrieval during conversations. */
  keywords: string[];
  /** One conversational sentence the companion can share. */
  insight: string;
  body: string[];
  technique?: Technique;
  seekHelp?: string;
  sources: { name: string; url: string }[];
  readMinutes: number;
}

const SRC = {
  nhsSelfHelp: { name: "NHS — Mental health self-help", url: "https://www.nhs.uk/mental-health/self-help/" },
  everyMind: { name: "NHS Every Mind Matters", url: "https://www.nhs.uk/every-mind-matters/" },
  nimh: { name: "National Institute of Mental Health", url: "https://www.nimh.nih.gov/health/topics" },
  apa: { name: "American Psychological Association", url: "https://www.apa.org/topics" },
  who: { name: "World Health Organization — Mental health", url: "https://www.who.int/health-topics/mental-health" },
  cdcSleep: { name: "CDC — Sleep", url: "https://www.cdc.gov/sleep/" },
  mind: { name: "Mind — Information & support", url: "https://www.mind.org.uk/information-support/" },
  neff: { name: "Self-Compassion (Dr. Kristin Neff)", url: "https://self-compassion.org/" },
  ggsc: { name: "Greater Good Science Center, UC Berkeley", url: "https://greatergood.berkeley.edu/" },
  lifeline: { name: "988 Suicide & Crisis Lifeline", url: "https://988lifeline.org/" },
} as const;

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ───────────────────────── Stress & Anxiety ─────────────────────────
  {
    slug: "understanding-stress",
    title: "Understanding stress",
    category: "Stress & Anxiety",
    summary: "Stress is the body's built-in response to pressure. Short bursts can help; constant stress wears us down.",
    keywords: ["stress", "stressed", "stressful", "pressure", "under pressure", "too much", "overwhelmed", "overwhelm", "tense", "on edge", "busy", "juggling", "deadline", "deadlines", "a lot going on"],
    insight: "Stress is your body's way of gearing up to meet a challenge — it's useful in short bursts, but when it doesn't switch off it starts to drain sleep, mood and focus.",
    body: [
      "When we face a demand, the body releases hormones like adrenaline and cortisol. Heart rate rises, breathing quickens and muscles tense — the classic 'fight or flight' response. In short bursts this helps us focus and act.",
      "Problems tend to show up when pressure is constant and there's little chance to recover. Long-running stress can affect sleep, appetite, concentration, patience and physical health, and it often makes problems feel bigger than they are.",
      "What helps is usually a mix: recovering well (sleep, movement, time outdoors), breaking problems into smaller steps, staying connected with people, and using quick calming skills — like slow breathing — to bring the body's alarm system back down.",
    ],
    technique: {
      name: "The stress check-in",
      duration: "3 minutes",
      steps: [
        "Pause and name what you're feeling, in one or two words.",
        "Notice where you feel it in your body — jaw, shoulders, chest, stomach.",
        "Ask: what's one thing here I can influence, and one thing I can't?",
        "Choose one small action for the part you can influence.",
        "For the part you can't, try three slow breaths with a longer out-breath.",
      ],
      voiceScript:
        "Let's pause for a moment. First, name what you're feeling in a word or two. Then notice where you feel it in your body. Now ask yourself: what's one thing here I can influence, and one thing I can't? Pick one small step for the first, and for the second, take three slow breaths with a long, easy exhale.",
    },
    seekHelp: "If stress is affecting your sleep, health or daily life most days for several weeks, talking to a doctor or mental health professional can help.",
    sources: [SRC.nhsSelfHelp, SRC.apa, SRC.who],
    readMinutes: 3,
  },
  {
    slug: "paced-breathing",
    title: "Paced breathing for calm",
    category: "Skills & Practices",
    summary: "Slowing your breath — especially the out-breath — is one of the quickest ways to settle a racing body.",
    keywords: ["breathing", "breathe", "breath", "calm down", "relax", "relaxation", "heart racing", "racing heart", "nervous", "tense", "panic", "calm", "settle", "box breathing"],
    insight: "Slowing your breathing, especially making the out-breath longer than the in-breath, nudges the nervous system toward its 'rest and digest' mode.",
    body: [
      "Breathing is one of the few parts of the stress response we can steer directly. Slow, steady breathing with a longer exhale activates the parasympathetic nervous system, which helps lower heart rate and muscle tension.",
      "You don't need to breathe deeply or force anything. Gentle breaths through the nose, at around five or six breaths a minute, are enough for most people. If counting makes you more tense, simply make each out-breath a little slower than the in-breath.",
      "A popular variation is box breathing: in for four, hold for four, out for four, hold for four. Try a few rounds and use whichever pattern feels most comfortable.",
    ],
    technique: {
      name: "4–6 breathing",
      duration: "2 minutes",
      steps: [
        "Sit or stand comfortably and let your shoulders drop.",
        "Breathe in gently through your nose for a count of 4.",
        "Breathe out slowly through your mouth or nose for a count of 6.",
        "Repeat for about ten breaths, letting the rhythm become easy.",
        "If you feel light-headed, return to normal breathing.",
      ],
      voiceScript:
        "Let's breathe together. Let your shoulders drop. Breathe in gently through your nose for four… two, three, four. And out slowly for six… two, three, four, five, six. Let's do that a few more times at your own pace, letting each out-breath be a little longer and softer.",
      pacer: { inhale: 4, exhale: 6 },
    },
    sources: [SRC.nhsSelfHelp, SRC.everyMind],
    readMinutes: 2,
  },
  {
    slug: "grounding-5-4-3-2-1",
    title: "5-4-3-2-1 grounding",
    category: "Stress & Anxiety",
    summary: "A sensory exercise that pulls attention out of spiralling thoughts and back into the present moment.",
    keywords: ["grounding", "spiralling", "spiraling", "racing thoughts", "panicky", "anxious", "anxiety", "overwhelmed", "dissociate", "zoned out", "present", "can't focus", "head is spinning", "freaking out"],
    insight: "When thoughts are racing, deliberately noticing what you can see, hear and touch gives the mind something concrete to hold onto.",
    body: [
      "Grounding techniques work by shifting attention from worries about the past or future to sensory information from right now. They're simple, quick and can be done anywhere without anyone noticing.",
      "The 5-4-3-2-1 method walks through your senses one at a time. Go slowly — the point isn't to finish, it's to really notice each thing.",
    ],
    technique: {
      name: "5-4-3-2-1",
      duration: "3–5 minutes",
      steps: [
        "Name 5 things you can see around you.",
        "Notice 4 things you can feel — your feet on the floor, fabric on your skin.",
        "Listen for 3 things you can hear, near or far.",
        "Find 2 things you can smell (or two scents you like).",
        "Notice 1 thing you can taste, or take a sip of water.",
      ],
      voiceScript:
        "Let's try grounding together. Look around and name five things you can see. Now notice four things you can feel, like your feet on the floor. Listen for three things you can hear. Find two things you can smell. And one thing you can taste. Take your time with each one.",
    },
    sources: [SRC.nhsSelfHelp, SRC.mind],
    readMinutes: 2,
  },
  {
    slug: "understanding-anxiety",
    title: "Understanding worry and anxiety",
    category: "Stress & Anxiety",
    summary: "Anxiety is a normal, protective emotion. It becomes a problem when it's frequent, intense or starts to shrink your life.",
    keywords: ["anxiety", "anxious", "worry", "worried", "worrying", "nervous", "fear", "scared", "afraid", "uneasy", "what if", "dread", "on edge", "social anxiety", "avoid", "avoiding"],
    insight: "Anxiety is your brain trying to protect you from possible threats — the tricky part is that avoiding what makes us anxious usually keeps the anxiety going.",
    body: [
      "Everyone feels anxious sometimes. It's the mind and body preparing for something that might go wrong — a racing heart, tight chest, restless thoughts, 'what if' questions.",
      "Anxiety tends to grow when we avoid the things that trigger it. Avoidance brings quick relief, but it teaches the brain that the situation really was dangerous. Approaching feared situations gradually, in small manageable steps, usually helps anxiety shrink over time.",
      "Calming skills (slow breathing, grounding), limiting caffeine, regular sleep and movement, and noticing anxious thought patterns can all help. Anxiety is also very treatable — talking therapies such as CBT have strong evidence.",
    ],
    seekHelp: "If worry is hard to control, happens most days, or stops you doing things you need or want to do, a doctor or licensed therapist can help.",
    sources: [SRC.nimh, SRC.nhsSelfHelp, SRC.apa],
    readMinutes: 3,
  },
  {
    slug: "panic-sensations",
    title: "When your body sounds the alarm",
    category: "Stress & Anxiety",
    summary: "Sudden waves of intense fear with strong physical sensations feel frightening, but they rise, peak and pass.",
    keywords: ["panic", "panic attack", "panicking", "can't breathe", "heart pounding", "chest tight", "dizzy", "shaking", "sweating", "losing control", "surge of fear"],
    insight: "Surges of panic feel overwhelming, but they typically peak within minutes and then ease — trying to fight them often makes them stronger, while letting them pass helps them settle.",
    body: [
      "A panic surge is the body's alarm system firing at full volume: pounding heart, fast breathing, dizziness, shaking, tingling, or a sense of dread. It's very uncomfortable, and many people fear something terrible is happening.",
      "These waves usually peak within about ten minutes and then subside. Fighting the sensations or fleeing tends to keep the alarm going, while slowing the breath and letting the wave pass teaches the body it's safe.",
      "Important: if you have new chest pain, trouble breathing, or symptoms you've never had before, get urgent medical help to rule out a physical cause.",
    ],
    technique: {
      name: "Riding the wave",
      duration: "5–10 minutes",
      steps: [
        "Name it: 'This is a wave of panic. It's uncomfortable, and it will pass.'",
        "Slow your breathing — gentle breaths with a longer out-breath.",
        "Ground yourself: press your feet into the floor and notice five things you see.",
        "Let the sensations be there without fighting them; imagine them as a wave rising and falling.",
        "Afterwards, be kind to yourself — that took courage.",
      ],
      voiceScript:
        "Remind yourself: this is a wave, it's uncomfortable, and it will pass. Let your breath slow down, with a longer, softer out-breath. Press your feet into the floor and notice what you can see around you. You don't have to fight the feelings — let them rise and fall like a wave. I'm here with you.",
    },
    seekHelp: "If panic surges happen repeatedly or you start avoiding places for fear of them, talk to a doctor or therapist — this is very treatable.",
    sources: [SRC.nimh, SRC.nhsSelfHelp],
    readMinutes: 3,
  },
  {
    slug: "study-stress",
    title: "Study and exam pressure",
    category: "Stress & Anxiety",
    summary: "Exams and coursework can feel all-consuming. A few evidence-based study habits make the load lighter.",
    keywords: ["exam", "exams", "test", "studying", "study", "student", "assignment", "assignments", "coursework", "grades", "university", "college", "school", "revision", "thesis", "finals", "homework"],
    insight: "Short, spaced study sessions with self-testing tend to beat long cramming sessions — and sleep is when the brain locks in what you've learned.",
    body: [
      "Academic pressure is one of the most common sources of stress. It often comes with comparison, fear of failure and a feeling that rest must be 'earned'.",
      "Learning research consistently favours spaced practice (shorter sessions spread over days) and retrieval practice (testing yourself rather than re-reading). Both feel harder in the moment but stick better.",
      "Breaks, movement and sleep are not wasted time — they protect focus and memory. It can also help to remember that a single grade rarely defines a path as much as it seems to in the moment.",
    ],
    technique: {
      name: "Focus blocks",
      duration: "25–30 minutes",
      steps: [
        "Pick one specific task (\"summarise chapter 3\", not \"study biology\").",
        "Put your phone in another room or on focus mode.",
        "Work for 25 minutes, then take a 5-minute break away from the screen.",
        "At the end of each block, close your notes and jot down what you remember.",
        "After four blocks, take a longer break.",
      ],
      voiceScript:
        "Try a focus block. Choose one small, specific task, put your phone out of reach, and work for twenty-five minutes. Then take five minutes away from the screen. At the end, close your notes and see what you can remember — that's where the learning really sticks.",
    },
    sources: [SRC.apa, SRC.everyMind],
    readMinutes: 3,
  },

  // ───────────────────────── Mood & Emotions ─────────────────────────
  {
    slug: "low-mood",
    title: "When your mood is low",
    category: "Mood & Emotions",
    summary: "Low mood often drains motivation. Waiting to feel like it rarely works — small actions can come first.",
    keywords: ["sad", "down", "low", "low mood", "unmotivated", "no motivation", "empty", "flat", "blue", "unhappy", "nothing helps", "can't be bothered", "numb", "meh", "lost interest", "crying", "depressed"],
    insight: "When mood is low, motivation often follows action rather than the other way round — even a small, doable activity can shift things a little.",
    body: [
      "Everyone has low days, and low mood is a common response to stress, loss, loneliness or exhaustion. It can make things that used to be enjoyable feel pointless, which leads us to do less — and doing less tends to deepen the low mood.",
      "An approach called behavioural activation flips this cycle: you plan small activities that bring a sense of enjoyment, connection or achievement, and do them even before the motivation arrives. Small and specific works best — a ten-minute walk, texting a friend, making a proper breakfast.",
      "Being gentle with yourself matters too. Low mood often comes with a harsh inner voice; noticing it, rather than believing everything it says, can take some of its power away.",
    ],
    technique: {
      name: "One small step",
      duration: "5 minutes to plan",
      steps: [
        "List three small activities that used to bring you a bit of enjoyment, connection or accomplishment.",
        "Pick the easiest one and shrink it until it feels almost too easy.",
        "Decide exactly when you'll do it today or tomorrow.",
        "Afterwards, rate your mood before and after from 0 to 10.",
        "Notice any shift, however small — that's information, not a test.",
      ],
      voiceScript:
        "Think of three small things that used to bring you a little enjoyment or a sense of getting something done. Pick the easiest one, and make it even smaller — so small it almost feels too easy. Then decide exactly when you'll do it. Afterwards, notice your mood before and after. Small shifts count.",
    },
    seekHelp: "If low mood lasts most of the day, most days, for more than two weeks — or you've lost interest in things you used to enjoy — please talk to a doctor or licensed mental health professional.",
    sources: [SRC.nhsSelfHelp, SRC.nimh, SRC.mind],
    readMinutes: 3,
  },
  {
    slug: "movement-and-mood",
    title: "Movement and mood",
    category: "Sleep & Energy",
    summary: "Physical activity is one of the most reliable everyday mood supports — and it doesn't need to be intense.",
    keywords: ["exercise", "walk", "walking", "gym", "workout", "running", "move", "movement", "active", "sluggish", "lethargic", "energy", "tired", "sitting all day", "sedentary"],
    insight: "Even a short walk can lift mood and energy, and regular movement is linked to lower levels of stress and anxiety.",
    body: [
      "Regular physical activity is associated with better mood, lower anxiety and better sleep. The World Health Organization recommends adults aim for 150–300 minutes of moderate activity a week — but any amount is better than none.",
      "The best activity is the one you'll actually do. Walking, dancing in the kitchen, stretching, cycling or gardening all count. Being outdoors and moving with other people can add extra benefits.",
    ],
    technique: {
      name: "The 10-minute walk",
      duration: "10 minutes",
      steps: [
        "Step outside if you can (or walk around your home).",
        "Walk at a comfortable pace for ten minutes.",
        "For one minute, notice what you see, hear and smell along the way.",
        "When you return, check in: has anything shifted in your body or mood?",
      ],
      voiceScript:
        "If you can, step outside for a ten-minute walk at an easy pace. For one minute along the way, really notice what you see, hear and smell. When you get back, check in with how your body and mood feel.",
    },
    sources: [SRC.who, SRC.everyMind],
    readMinutes: 2,
  },
  {
    slug: "burnout",
    title: "Work stress and burnout",
    category: "Mood & Emotions",
    summary: "Burnout comes from chronic work stress that isn't being managed: exhaustion, cynicism and feeling less effective.",
    keywords: ["burnout", "burned out", "burnt out", "work", "job", "boss", "manager", "workload", "overtime", "exhausted", "drained", "no work-life balance", "colleagues", "office", "career", "shift", "shifts", "work stress"],
    insight: "Burnout tends to build when demands stay high and recovery stays low for a long time — protecting small pockets of real rest matters more than it seems.",
    body: [
      "The World Health Organization describes burnout as an occupational phenomenon resulting from chronic workplace stress that hasn't been successfully managed. It's characterised by exhaustion, feeling mentally distant or cynical about work, and a reduced sense of effectiveness.",
      "Burnout isn't a personal failing — it usually reflects a mismatch between demands and resources. Useful steps include clarifying priorities with a manager, setting boundaries around availability, taking real breaks, and noticing which tasks drain versus restore you.",
    ],
    technique: {
      name: "Energy audit",
      duration: "10 minutes",
      steps: [
        "Draw two columns: 'drains me' and 'restores me'.",
        "List the activities from a typical week in each column.",
        "Circle one drain you could reduce, delegate or set a boundary around.",
        "Circle one restorer you could protect a little more time for.",
        "Pick one tiny change to try this week.",
      ],
      voiceScript:
        "Try an energy audit. Think about a typical week and sort activities into two piles: things that drain you and things that restore you. Then pick one drain you could shrink a little, and one restorer you could protect more time for. Just one small change this week.",
    },
    seekHelp: "If work stress is affecting your health, sleep or relationships, consider speaking with a doctor, an employee assistance programme, or a therapist.",
    sources: [SRC.who, SRC.apa],
    readMinutes: 3,
  },
  {
    slug: "anger",
    title: "Working with anger",
    category: "Mood & Emotions",
    summary: "Anger is a normal signal that something feels unfair or threatened. Pausing gives you a choice about what to do with it.",
    keywords: ["angry", "anger", "furious", "mad", "irritated", "irritable", "frustrated", "frustration", "annoyed", "rage", "snapped", "lose my temper", "short-tempered", "resentful"],
    insight: "Anger often carries useful information about what matters to us — a short pause between the feeling and the reaction is where the choice lives.",
    body: [
      "Anger is a natural emotion that often signals that a boundary has been crossed, a need isn't being met, or something feels unfair. It comes with physical arousal — heat, tension, a faster heart — which makes it hard to think clearly in the moment.",
      "Helpful anger management focuses on the pause: noticing early signs, giving the body a chance to settle, and then expressing the underlying need clearly and respectfully rather than suppressing it or exploding.",
    ],
    technique: {
      name: "STOP",
      duration: "1 minute",
      steps: [
        "S — Stop what you're doing for a moment.",
        "T — Take a slow breath (or three).",
        "O — Observe: what am I feeling, where in my body, and what's the need underneath?",
        "P — Proceed with a choice: respond, step away for now, or come back to it later.",
      ],
      voiceScript:
        "Let's use STOP. Stop for a moment. Take a slow breath. Observe what you're feeling, where it sits in your body, and what need might be underneath it. Then proceed with a choice — respond calmly, step away for now, or come back to it later.",
    },
    sources: [SRC.apa, SRC.mind],
    readMinutes: 2,
  },
  {
    slug: "grief-and-loss",
    title: "Grief and loss",
    category: "Mood & Emotions",
    summary: "Grief has no correct timeline or order. It often comes in waves, moving between pain and getting on with life.",
    keywords: ["grief", "grieving", "loss", "lost someone", "died", "death", "passed away", "funeral", "miss them", "bereavement", "breakup", "break up", "divorce", "pet died", "mourning"],
    insight: "Grief rarely moves in neat stages — it's common to swing between waves of sadness and moments of ordinary life, and both are part of grieving.",
    body: [
      "Grief is a natural response to losing someone or something important — a person, a relationship, a pet, a job, a version of the future. It can bring sadness, numbness, anger, guilt, relief, or all of these in one day.",
      "Researchers describe healthy grieving as moving back and forth between facing the loss and attending to everyday life. Taking breaks from grief isn't avoidance; it's part of how people cope.",
      "Talking about the person or thing you've lost, keeping simple routines, and accepting support can help. There's no deadline for feeling 'better'.",
    ],
    seekHelp: "If grief feels stuck, overwhelming or makes daily life very hard for a long time, bereavement counsellors and therapists can help.",
    sources: [SRC.nhsSelfHelp, SRC.mind, SRC.apa],
    readMinutes: 3,
  },

  // ───────────────────────── Sleep & Energy ─────────────────────────
  {
    slug: "sleep-basics",
    title: "Sleep foundations",
    category: "Sleep & Energy",
    summary: "Consistent timing, morning light and a wind-down routine are the backbone of better sleep.",
    keywords: ["sleep", "sleeping", "tired", "exhausted", "insomnia", "bedtime", "night", "fatigue", "rest", "nap", "caffeine", "coffee", "wake up", "waking up", "sleep schedule"],
    insight: "A consistent wake-up time — even on weekends — is one of the most powerful levers for steadier sleep.",
    body: [
      "Most adults need at least seven hours of sleep. Sleep affects mood, focus, patience and how we cope with stress — and stress, in turn, affects sleep.",
      "Helpful habits include: waking at a similar time every day, getting daylight in the morning, keeping caffeine to earlier in the day, limiting alcohol close to bedtime, and keeping the bedroom dark, quiet and cool.",
      "A wind-down routine signals to the brain that it's time to switch off: dim lights, put screens away if you can, and do something calm and repetitive for 30–60 minutes before bed.",
    ],
    technique: {
      name: "Wind-down routine",
      duration: "30–60 minutes",
      steps: [
        "Set a 'wind-down alarm' about an hour before bed.",
        "Dim the lights and park your phone outside reach if you can.",
        "Jot down tomorrow's to-dos so your mind can let go of them.",
        "Do something calm: a shower, stretching, light reading, or slow breathing.",
        "Go to bed when you feel sleepy, and get up at your usual time.",
      ],
      voiceScript:
        "Try setting a wind-down alarm about an hour before bed. Dim the lights, move your phone out of reach, and jot down anything on your mind for tomorrow. Then do something calm, like a warm shower or gentle stretching, and head to bed when you feel sleepy.",
    },
    seekHelp: "If poor sleep lasts for weeks and affects your days, talk to a doctor. Cognitive behavioural therapy for insomnia (CBT-I) is a highly effective, recommended treatment.",
    sources: [SRC.cdcSleep, SRC.nhsSelfHelp],
    readMinutes: 3,
  },
  {
    slug: "cant-sleep",
    title: "When you can't fall asleep",
    category: "Sleep & Energy",
    summary: "Lying awake and trying hard to sleep usually backfires. Getting up for a while can reset the brain's sleep association.",
    keywords: ["can't sleep", "cant sleep", "lying awake", "awake at night", "racing mind at night", "up all night", "insomnia", "3am", "middle of the night", "overthinking at night", "toss and turn"],
    insight: "If you've been awake in bed for about twenty minutes, getting up to do something calm in dim light — and returning when sleepy — helps the brain re-link bed with sleep.",
    body: [
      "The harder we try to sleep, the more alert we become. Over time, the bed can become associated with frustration and wakefulness rather than rest.",
      "Sleep specialists recommend 'stimulus control': use the bed only for sleep (and intimacy), and if you're awake for roughly twenty minutes, get up and do something quiet in dim light until you feel sleepy again. Avoid checking the clock.",
      "A racing mind at night often responds well to a short 'brain dump' earlier in the evening — writing worries and to-dos on paper so they're held somewhere other than your head.",
    ],
    technique: {
      name: "Get up and reset",
      duration: "As needed",
      steps: [
        "Turn the clock away so you can't watch the minutes.",
        "If you've been awake a while and feel frustrated, get up.",
        "Go to another dimly lit space and do something calm (a dull book, folding laundry, slow breathing).",
        "Return to bed only when you feel sleepy.",
        "Keep the same wake-up time tomorrow, even after a rough night.",
      ],
      voiceScript:
        "If you've been lying awake for a while, it's okay to get up. Go somewhere dimly lit and do something calm and a little boring, like reading or slow breathing. Head back to bed when you feel sleepy, and try to keep your usual wake-up time tomorrow.",
    },
    sources: [SRC.cdcSleep, SRC.nhsSelfHelp],
    readMinutes: 2,
  },

  // ───────────────────────── Relationships ─────────────────────────
  {
    slug: "loneliness",
    title: "Loneliness and connection",
    category: "Relationships",
    summary: "Loneliness is about the gap between the connection we want and the connection we have — and it's more common than it looks.",
    keywords: ["lonely", "loneliness", "alone", "isolated", "no friends", "left out", "disconnected", "nobody to talk to", "miss people", "moved", "new city", "by myself", "no one understands"],
    insight: "Loneliness is incredibly common, and connection often grows from small, repeated moments rather than big gestures.",
    body: [
      "Loneliness isn't the same as being alone — you can feel lonely in a crowd or content on your own. It's the feeling that our connections don't match what we need.",
      "The World Health Organization recognises social connection as important for health. Rebuilding connection usually starts small: a message to an old friend, a regular class or club, volunteering, or chatting with a neighbour. Repetition matters more than intensity.",
      "Loneliness can also make us more wary of others, so reaching out may feel awkward at first. That awkwardness is normal and usually fades with practice.",
    ],
    technique: {
      name: "One small reach-out",
      duration: "5 minutes",
      steps: [
        "Think of one person you've enjoyed talking to, even long ago.",
        "Send a short, low-pressure message (\"This made me think of you — how are things?\").",
        "Look for one regular activity where you'd see the same faces weekly.",
        "Notice and acknowledge your effort, whatever the response.",
      ],
      voiceScript:
        "Think of one person you've enjoyed talking to, even if it's been a while. A short, low-pressure message is enough, like 'this reminded me of you, how are things?' Then think about one regular activity where you might see the same faces each week. Small, repeated moments build connection.",
    },
    sources: [SRC.who, SRC.everyMind, SRC.mind],
    readMinutes: 3,
  },
  {
    slug: "healthy-communication",
    title: "Talking through difficult things",
    category: "Relationships",
    summary: "Clear, kind communication — speaking from your own experience and really listening — reduces conflict.",
    keywords: ["argument", "arguments", "fight", "fighting", "conflict", "partner", "relationship", "communicate", "communication", "misunderstood", "family tension", "roommate", "talk to them", "difficult conversation", "parents"],
    insight: "Starting with how you feel and what you need — rather than what the other person did wrong — makes it much easier for them to really hear you.",
    body: [
      "Conflict is a normal part of close relationships. What matters most is how we repair and talk things through.",
      "'I-statements' describe your experience without blaming: \"I feel overwhelmed when the plans change last minute, and I'd love a heads-up\" lands very differently from \"You always ruin plans.\"",
      "Listening well means trying to understand before responding: reflecting back what you heard, asking questions, and choosing a calm moment rather than the heat of an argument.",
    ],
    technique: {
      name: "I-statements",
      duration: "2 minutes to prepare",
      steps: [
        "\"I feel…\" — name your emotion.",
        "\"…when…\" — describe the specific situation, not the person's character.",
        "\"…because…\" — share why it matters to you.",
        "\"…and I'd like…\" — make a clear, doable request.",
        "Then listen and reflect back what you hear.",
      ],
      voiceScript:
        "Try shaping it as an I-statement: I feel, then the emotion; when, then the specific situation; because, then why it matters to you; and I'd like, followed by a clear request. Then listen and reflect back what you hear from them.",
    },
    sources: [SRC.apa, SRC.ggsc],
    readMinutes: 2,
  },
  {
    slug: "boundaries",
    title: "Setting kind boundaries",
    category: "Relationships",
    summary: "Boundaries are clear statements of what you can and can't do. They protect relationships rather than damage them.",
    keywords: ["boundaries", "boundary", "saying no", "say no", "people pleaser", "people pleasing", "taken advantage", "too much on my plate", "guilt", "obligation", "can't say no"],
    insight: "A boundary is less about controlling others and more about being clear on what you can offer — and it's okay for it to feel uncomfortable at first.",
    body: [
      "Boundaries help us protect our time, energy and values. Without them, resentment and exhaustion tend to build.",
      "Good boundaries are clear, kind and specific: \"I can't take that on this week, but I could help next Tuesday.\" You don't owe a long justification. Guilt is common at first, especially if you're used to putting others first — it usually eases with practice.",
    ],
    technique: {
      name: "Clear and kind",
      duration: "2 minutes",
      steps: [
        "Decide what you can genuinely offer (and what you can't).",
        "Acknowledge the other person: \"I can see this matters to you.\"",
        "State your limit simply: \"I'm not able to…\"",
        "Offer an alternative if you want to: \"What I can do is…\"",
        "Resist over-explaining. Repeat calmly if needed.",
      ],
      voiceScript:
        "First decide what you can genuinely offer. Then acknowledge the other person, state your limit simply, and offer an alternative if you'd like. You don't need to over-explain — a calm, kind 'I'm not able to, but here's what I can do' is enough.",
    },
    sources: [SRC.apa, SRC.mind],
    readMinutes: 2,
  },
  {
    slug: "supporting-someone",
    title: "Supporting someone who's struggling",
    category: "Relationships",
    summary: "You don't need the perfect words. Listening, staying connected and encouraging support make a real difference.",
    keywords: ["friend is struggling", "worried about my friend", "worried about someone", "help a friend", "support someone", "family member struggling", "how to help", "my friend is depressed", "my partner is struggling"],
    insight: "When someone is struggling, listening without rushing to fix things is often the most helpful thing you can offer.",
    body: [
      "Supporting someone starts with noticing and reaching out. Listen more than you speak, avoid judging or minimising, and let them know you care.",
      "If you're worried someone might be thinking about suicide, it's okay to ask directly. Research shows asking does not put the idea in someone's head, and it can open the door to help. If they're in immediate danger, contact emergency services.",
      "Encourage professional support and offer practical help, like finding a number or going with them to an appointment. And look after yourself too — supporting others can be draining.",
    ],
    sources: [SRC.lifeline, SRC.mind, SRC.nimh],
    readMinutes: 3,
  },

  // ───────────────────────── Thinking Patterns ─────────────────────────
  {
    slug: "thought-reframing",
    title: "Catching and reframing unhelpful thoughts",
    category: "Thinking Patterns",
    summary: "Thoughts aren't facts. Noticing common thinking traps lets you find a more balanced view.",
    keywords: ["negative thoughts", "overthinking", "catastrophising", "catastrophizing", "worst case", "what if", "i'm a failure", "not good enough", "everyone hates me", "always", "never", "self-doubt", "inner critic", "should", "thoughts"],
    insight: "When we're stressed the mind tends to jump to the worst case — gently asking 'what's the evidence for and against this thought?' can loosen its grip.",
    body: [
      "Cognitive behavioural therapy (CBT) is built on the idea that thoughts, feelings and behaviours influence each other. When we're anxious or low, thoughts often fall into predictable traps: all-or-nothing thinking, catastrophising, mind reading, or harsh 'should' statements.",
      "Reframing isn't about forcing positive thinking. It's about finding a more balanced, realistic perspective — one you can actually believe.",
    ],
    technique: {
      name: "Catch it, check it, change it",
      duration: "5 minutes",
      steps: [
        "Catch it: write down the thought exactly as it showed up.",
        "Check it: what's the evidence for it? What's the evidence against it?",
        "Ask: what would I say to a friend who had this thought?",
        "Change it: write a more balanced version you genuinely believe.",
        "Notice how strongly you believe each version, from 0 to 100.",
      ],
      voiceScript:
        "Let's try catch it, check it, change it. First, catch the thought exactly as it showed up. Then check it — what's the evidence for it, and what's the evidence against it? What would you say to a friend thinking this? Finally, change it into a more balanced version that you can genuinely believe.",
    },
    sources: [SRC.nhsSelfHelp, SRC.apa, SRC.everyMind],
    readMinutes: 3,
  },
  {
    slug: "worry-time",
    title: "Scheduled worry time",
    category: "Thinking Patterns",
    summary: "Instead of worrying all day, postpone worries to a short, set time — it helps the mind learn that worries can wait.",
    keywords: ["worry", "worrying", "constant worry", "can't stop thinking", "overthinking", "what ifs", "ruminating", "worried all the time", "anxious thoughts", "mind won't stop"],
    insight: "Giving worries a fixed appointment — say fifteen minutes in the early evening — can make it easier to set them down the rest of the day.",
    body: [
      "Worry often feels urgent, as though it must be dealt with right now. Worry postponement is a CBT technique that teaches the brain that worries can wait.",
      "During the day, when a worry pops up, jot it down and postpone it. At your worry time, look at the list: many worries will have faded. For those that remain, ask whether they're solvable now (make a plan) or hypothetical (practise letting them go).",
    ],
    technique: {
      name: "Worry postponement",
      duration: "15 minutes a day",
      steps: [
        "Choose a 15-minute 'worry time' each day — not right before bed.",
        "When a worry appears during the day, write it down in a few words and postpone it.",
        "Gently return your attention to what you were doing.",
        "At worry time, review the list. Cross off what no longer matters.",
        "For practical worries, plan one next step. For 'what ifs', practise letting them pass.",
      ],
      voiceScript:
        "Pick a fifteen-minute worry time each day, not too close to bedtime. When a worry shows up during the day, jot it down and tell yourself: I'll think about this later. Then come back to what you were doing. At worry time, look at the list — some will have faded, and for the practical ones, plan one next step.",
    },
    sources: [SRC.nhsSelfHelp, SRC.everyMind],
    readMinutes: 2,
  },
  {
    slug: "rumination",
    title: "Getting unstuck from rumination",
    category: "Thinking Patterns",
    summary: "Going over and over the same thoughts feels like problem-solving but usually isn't. Shifting from 'why' to 'what next' helps.",
    keywords: ["ruminating", "rumination", "replaying", "can't let go", "going over and over", "dwelling", "stuck in my head", "keep thinking about", "regret", "should have"],
    insight: "Rumination tends to ask 'why did this happen?' on repeat — switching to 'what's one small thing I could do next?' can help the mind move forward.",
    body: [
      "Rumination is repetitive dwelling on problems, mistakes or feelings. It can feel productive, but it tends to deepen low mood and anxiety without leading to solutions.",
      "Helpful shifts: noticing when you've been looping (\"I'm ruminating again\"), moving from abstract 'why' questions to concrete 'how' or 'what next' questions, and engaging in absorbing activities that use your attention fully.",
    ],
    technique: {
      name: "From 'why' to 'what next'",
      duration: "3 minutes",
      steps: [
        "Notice and name it: \"I'm going round in circles.\"",
        "Ask: is this leading me toward a solution or a decision?",
        "If not, ask: what's one small, concrete thing I could do next?",
        "If nothing can be done right now, choose an absorbing activity for 15 minutes.",
      ],
      voiceScript:
        "When you notice you're going round in circles, name it: I'm ruminating. Ask yourself if it's leading anywhere. If not, switch from why to what next — what's one small, concrete step? And if there's nothing to do right now, give your attention to something absorbing for a little while.",
    },
    sources: [SRC.apa, SRC.mind],
    readMinutes: 2,
  },
  {
    slug: "procrastination",
    title: "Procrastination isn't laziness",
    category: "Thinking Patterns",
    summary: "Procrastination is often about avoiding uncomfortable feelings. Making the first step tiny lowers the barrier.",
    keywords: ["procrastinating", "procrastination", "putting off", "can't start", "can't get started", "lazy", "avoiding tasks", "to-do list", "behind on everything", "stuck", "motivation"],
    insight: "Procrastination is usually about avoiding an uncomfortable feeling, not about being lazy — and forgiving yourself for past procrastination actually makes it easier to start next time.",
    body: [
      "Research suggests procrastination is often a way of managing emotions: a task feels boring, confusing or threatening, so we avoid it to feel better in the short term.",
      "Making the first step tiny reduces that emotional barrier. Self-compassion helps too: studies have found that students who forgave themselves for procrastinating procrastinated less on the next exam.",
    ],
    technique: {
      name: "The five-minute start",
      duration: "5 minutes",
      steps: [
        "Pick the task and name the feeling it brings up (bored? anxious? unsure?).",
        "Define the smallest possible first action (open the document, write one sentence).",
        "Set a timer for five minutes and only commit to those five minutes.",
        "When it rings, choose freely: stop, or keep going.",
      ],
      voiceScript:
        "Pick the task and notice the feeling it brings up. Then find the smallest first action — like opening the document or writing one sentence. Set a timer for five minutes and only commit to that. When it rings, you're free to stop or keep going.",
    },
    sources: [SRC.apa, SRC.ggsc],
    readMinutes: 2,
  },
  {
    slug: "problem-solving",
    title: "Structured problem-solving",
    category: "Thinking Patterns",
    summary: "Breaking a problem into clear steps turns a vague, heavy feeling into something you can act on.",
    keywords: ["problem", "problems", "decision", "decide", "don't know what to do", "stuck", "options", "solution", "figure out", "dilemma", "plan"],
    insight: "Writing a problem down and brainstorming options — without judging them yet — often makes it feel more manageable.",
    body: [
      "When we're stressed, problems can feel like one big tangled knot. Structured problem-solving, used in several evidence-based therapies, untangles the knot into steps.",
      "It works best for practical problems. For worries about things outside your control, skills like worry postponement or acceptance tend to fit better.",
    ],
    technique: {
      name: "Six-step problem-solving",
      duration: "15 minutes",
      steps: [
        "Define the problem in one specific sentence.",
        "Brainstorm every possible option — no judging yet.",
        "List pros and cons for the most promising few.",
        "Choose one option (it doesn't need to be perfect).",
        "Plan the first step: what, when, where.",
        "Try it, then review how it went and adjust.",
      ],
      voiceScript:
        "Let's break it down. Describe the problem in one specific sentence. Then brainstorm every option you can think of, without judging. Weigh up the pros and cons of a few, pick one that's good enough, and plan the very first step — what, when and where. Afterwards, review and adjust.",
    },
    sources: [SRC.apa, SRC.nhsSelfHelp],
    readMinutes: 2,
  },

  // ───────────────────────── Skills & Practices ─────────────────────────
  {
    slug: "self-compassion",
    title: "Self-compassion",
    category: "Skills & Practices",
    summary: "Treating yourself with the kindness you'd offer a friend builds resilience — it's not the same as letting yourself off the hook.",
    keywords: ["self-critical", "hard on myself", "hate myself", "failure", "not good enough", "ashamed", "shame", "guilt", "guilty", "embarrassed", "mistake", "messed up", "self-esteem", "confidence", "worthless"],
    insight: "Research on self-compassion suggests that speaking to yourself the way you'd speak to a good friend helps people bounce back from setbacks — it's motivating, not indulgent.",
    body: [
      "Self-compassion, as described by researcher Kristin Neff, has three parts: mindfulness (acknowledging the pain without exaggerating it), common humanity (remembering that struggle is part of being human), and self-kindness (offering yourself warmth instead of harsh judgement).",
      "Many people worry that self-compassion will make them complacent. Studies suggest the opposite: it's linked to greater motivation, resilience and willingness to learn from mistakes.",
    ],
    technique: {
      name: "Self-compassion break",
      duration: "2 minutes",
      steps: [
        "Acknowledge: \"This is a moment of difficulty.\"",
        "Connect: \"Struggling is part of being human — I'm not alone in this.\"",
        "Offer kindness: place a hand on your chest and ask, \"What do I need to hear right now?\"",
        "Say it to yourself, the way you would to a good friend.",
      ],
      voiceScript:
        "Let's try a self-compassion break. Say to yourself: this is a hard moment. Then: struggling is part of being human, I'm not alone in this. If it feels okay, rest a hand on your chest and ask, what do I need to hear right now? Then offer yourself those words, the way you'd say them to a good friend.",
    },
    sources: [SRC.neff, SRC.ggsc],
    readMinutes: 2,
  },
  {
    slug: "mindfulness-basics",
    title: "Mindfulness in everyday life",
    category: "Skills & Practices",
    summary: "Mindfulness means paying attention to the present moment with curiosity instead of judgement — it can be practised in a minute.",
    keywords: ["mindfulness", "mindful", "meditation", "meditate", "present moment", "distracted", "autopilot", "busy mind", "can't switch off", "relax"],
    insight: "Mindfulness isn't about emptying the mind — it's noticing where your attention has wandered and kindly bringing it back, again and again.",
    body: [
      "Mindfulness is often described as paying attention, on purpose, in the present moment, without judgement. Regular practice is associated with reduced stress and improved emotional regulation.",
      "You don't need long meditation sessions. Brief, informal practices — noticing your breath, eating a meal without your phone, feeling your feet as you walk — all count. Wandering attention isn't failure; noticing it is the practice.",
    ],
    technique: {
      name: "One mindful minute",
      duration: "1 minute",
      steps: [
        "Set a one-minute timer and sit comfortably.",
        "Notice the sensation of breathing — the nose, chest or belly.",
        "When your mind wanders, notice where it went, and gently come back.",
        "When the timer ends, notice how you feel without judging it.",
      ],
      voiceScript:
        "Let's take one mindful minute. Sit comfortably and notice your breathing — wherever you feel it most. When your mind wanders, and it will, just notice where it went and gently come back. That noticing is the whole practice.",
    },
    sources: [SRC.nhsSelfHelp, SRC.ggsc, SRC.apa],
    readMinutes: 2,
  },
  {
    slug: "gratitude-savoring",
    title: "Noticing the good: savouring and gratitude",
    category: "Skills & Practices",
    summary: "Our brains are wired to notice threats. Deliberately pausing on good moments helps balance the picture.",
    keywords: ["grateful", "gratitude", "happy", "good day", "good things", "positive", "savour", "savor", "joy", "enjoying", "proud", "excited", "content"],
    insight: "Pausing for a few extra seconds on a good moment — really letting it land — helps the brain hold onto it.",
    body: [
      "Humans have a 'negativity bias': we notice and remember threats more readily than good experiences. Savouring and gratitude practices help rebalance this.",
      "One well-studied exercise is 'Three Good Things': writing down three things that went well each day and why. In research, people who did this for a week reported improvements in wellbeing that lasted for weeks afterwards.",
    ],
    technique: {
      name: "Three good things",
      duration: "5 minutes",
      steps: [
        "Before bed, write down three things that went well today — big or small.",
        "For each one, note why it happened or what your part in it was.",
        "Take a few seconds to really remember each moment.",
        "Try it for a week and notice any changes.",
      ],
      voiceScript:
        "Here's a simple one: before bed, think of three things that went well today, big or small. For each one, ask why it happened, or what your part in it was. Then take a few seconds to really relive each moment.",
    },
    sources: [SRC.ggsc, SRC.apa],
    readMinutes: 2,
  },
  {
    slug: "progressive-muscle-relaxation",
    title: "Progressive muscle relaxation",
    category: "Skills & Practices",
    summary: "Tensing and releasing muscle groups teaches the body the difference between tension and relaxation.",
    keywords: ["tense", "tension", "tight shoulders", "muscle tension", "body feels tight", "clenching", "jaw", "headache", "can't relax", "physical stress", "relaxation"],
    insight: "Stress often hides in the body — briefly tensing a muscle group and then letting go helps you notice and release tension you didn't know you were holding.",
    body: [
      "Progressive muscle relaxation (PMR) was developed in the early twentieth century and is widely used for stress, anxiety and sleep difficulties. It involves tensing a group of muscles for a few seconds, then releasing and noticing the contrast.",
      "Skip any area that's injured or painful, and tense gently — never to the point of pain.",
    ],
    technique: {
      name: "Quick PMR",
      duration: "5–10 minutes",
      steps: [
        "Sit or lie comfortably and take a few slow breaths.",
        "Hands: make fists for 5 seconds, then release for 10–15 seconds.",
        "Shoulders: lift toward your ears for 5 seconds, then let them drop.",
        "Face: scrunch gently for 5 seconds, then soften your jaw and forehead.",
        "Legs and feet: tense, hold, release.",
        "Finish with a few slow breaths, noticing the feeling of relaxation.",
      ],
      voiceScript:
        "Let's try a quick muscle relaxation. Make gentle fists and hold for five seconds… and release, noticing the difference. Now lift your shoulders toward your ears… hold… and let them drop. Gently scrunch your face… and soften. Finish with a few slow breaths.",
    },
    sources: [SRC.nhsSelfHelp, SRC.mind],
    readMinutes: 2,
  },
  {
    slug: "journaling",
    title: "Writing it out",
    category: "Skills & Practices",
    summary: "Putting thoughts and feelings into words can make them clearer and less overwhelming.",
    keywords: ["journal", "journaling", "write", "writing", "diary", "process feelings", "confused", "make sense of", "bottled up", "vent"],
    insight: "Writing about difficult experiences for even fifteen minutes helps many people make sense of them — it can feel heavier at first, then lighter.",
    body: [
      "Expressive writing research, pioneered by psychologist James Pennebaker, found that writing about emotional experiences for 15–20 minutes on a few days was linked to improvements in wellbeing for many people.",
      "It's normal to feel a bit more emotional straight after writing. Write for yourself, not an audience: spelling and structure don't matter, and you can throw the page away afterwards.",
    ],
    technique: {
      name: "15-minute free write",
      duration: "15 minutes",
      steps: [
        "Find a private moment and set a 15-minute timer.",
        "Write continuously about what's on your mind and how it makes you feel.",
        "Don't edit or judge — just keep the pen moving.",
        "Afterwards, notice: is there anything I understand a little better now?",
      ],
      voiceScript:
        "Find a private moment and set a timer for fifteen minutes. Write continuously about what's on your mind and how it makes you feel — no editing, no judging. Afterwards, notice if anything feels a little clearer.",
    },
    sources: [SRC.apa, SRC.ggsc],
    readMinutes: 2,
  },

  // ───────────────────────── Getting Support ─────────────────────────
  {
    slug: "when-to-seek-help",
    title: "When to reach out for professional help",
    category: "Getting Support",
    summary: "You don't need to be in crisis to deserve support. Some signs suggest it's a good time to talk to a professional.",
    keywords: ["therapy", "therapist", "counselling", "counseling", "professional help", "should i see someone", "see a doctor", "psychologist", "psychiatrist", "get help", "need help", "diagnosis", "diagnose", "medication"],
    insight: "You don't have to wait until things are unbearable — if something has been affecting your daily life for a few weeks, it's a good time to talk to a professional.",
    body: [
      "Consider reaching out to a doctor or licensed mental health professional if: difficult feelings last for more than a couple of weeks; they affect work, study, relationships or sleep; you're relying on alcohol or other substances to cope; or friends and family have said they're worried.",
      "A good first step is often a GP or primary care doctor, a university or workplace counselling service, or a licensed therapist directory in your country. If you ever have thoughts of harming yourself, please contact a crisis line or emergency services right away.",
      "Only qualified professionals can assess and diagnose mental health conditions. An AI companion like this one can't — but it can help you think about what to say when you reach out.",
    ],
    sources: [SRC.nimh, SRC.nhsSelfHelp, SRC.lifeline],
    readMinutes: 3,
  },
  {
    slug: "types-of-support",
    title: "Who can help: a quick guide",
    category: "Getting Support",
    summary: "Psychologists, psychiatrists, counsellors, GPs and peer supporters each play a different role.",
    keywords: ["what is a psychologist", "psychiatrist", "counsellor", "counselor", "therapist", "therapy types", "cbt", "talking therapy", "support group", "peer support", "who should i talk to"],
    insight: "Different professionals offer different kinds of help — a GP or primary care doctor is often a good place to start and can point you in the right direction.",
    body: [
      "GP / primary care doctor: a good first stop. Can discuss what's going on, check for physical causes, and refer you onward.",
      "Psychologist: trained in assessment and evidence-based talking therapies such as CBT. Psychiatrist: a medical doctor specialising in mental health who can diagnose and prescribe medication. Counsellors and psychotherapists: provide talking therapies; titles and regulation vary by country.",
      "Peer support groups and helplines offer connection with people who understand. Crisis lines provide immediate, 24/7 support when things feel unsafe.",
    ],
    sources: [SRC.nimh, SRC.apa, SRC.mind],
    readMinutes: 2,
  },
];

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  "Stress & Anxiety",
  "Mood & Emotions",
  "Sleep & Energy",
  "Relationships",
  "Thinking Patterns",
  "Skills & Practices",
  "Getting Support",
];

export function getEntry(slug: string): KnowledgeEntry | undefined {
  return KNOWLEDGE_BASE.find((e) => e.slug === slug);
}
