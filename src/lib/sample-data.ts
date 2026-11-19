"use client";

import { conversationsStore, moodStore } from "./storage";
import type { ChatMessage, Conversation, MoodEntry } from "./types";
import { localDateKey } from "./utils";

/** Entirely fictional demo data ("Alex" is not a real person). */
const DAY = 86_400_000;

function msgs(start: number, turns: [ChatMessage["role"], string, ChatMessage["meta"]?][]): ChatMessage[] {
  return turns.map(([role, content, meta], i) => ({ id: `sample_${start}_${i}`, role, content, createdAt: start + i * 45_000, meta: { provider: "demo", ...meta } }));
}

export function buildSampleData(now = Date.now()): { conversations: Conversation[]; moods: MoodEntry[] } {
  const c1Start = now - 2 * DAY - 3 * 3_600_000;
  const c2Start = now - 5 * DAY - 6 * 3_600_000;

  const conversations: Conversation[] = [
    {
      id: "sample_chat_1",
      mode: "chat",
      title: "Busy week with deadlines (sample)",
      createdAt: c1Start,
      updatedAt: c1Start + 12 * 45_000,
      sample: true,
      messages: msgs(c1Start, [
        ["assistant", "Hi there, I'm Ari — an AI companion, here to chat and listen. I'm not a therapist, just a friendly ear. How's your day going so far?", { stage: "intro", topic: "day", questionId: "intro_day" }],
        ["user", "Busy but okay. Lots of deadlines this week."],
        ["assistant", "That sounds like a full week. By the way, what would you like me to call you? Totally fine to skip that one.", { stage: "intro", topic: "name", questionId: "intro_name" }],
        ["user", "Alex is fine"],
        ["assistant", "Lovely to meet you, Alex. Can I ask who's at home with you these days — do you live with family, friends, or on your own? Only if you feel like sharing.", { stage: "social", topic: "household", questionId: "social_household" }],
        ["user", "I share a flat with two friends from uni"],
        ["assistant", "Living with friends sounds like it could be a lot of fun. What do you all enjoy doing together when you get the chance?", { stage: "social", topic: "together", questionId: "social_together" }],
        ["user", "Sunday dinners mostly, and the occasional board game night"],
        ["assistant", "That sounds lovely. What keeps you busy day to day — are you working, studying, or something else entirely?", { stage: "lifestyle", topic: "occupation", questionId: "life_occupation" }],
        ["user", "I work as a designer at a small studio. Honestly the deadlines are making me a bit anxious and I can't switch off at night"],
        ["assistant", "Lying awake can be so draining, especially when your mind won't switch off. Giving worries a fixed appointment — say fifteen minutes in the early evening — can make it easier to set them down the rest of the day. There's a short exercise called \"Worry postponement\" that can help. Would you like to try it together?", { stage: "support", topic: "technique", techniqueOffered: "worry-time", sources: [{ slug: "worry-time", title: "Scheduled worry time" }] }],
        ["user", "yes let's try"],
        ["assistant", "Okay, let's try it together.\n\n**Worry postponement** (15 minutes a day):\n1. Choose a 15-minute 'worry time' each day — not right before bed.\n2. When a worry appears during the day, write it down in a few words and postpone it.\n3. Gently return your attention to what you were doing.\n4. At worry time, review the list. Cross off what no longer matters.\n5. For practical worries, plan one next step. For 'what ifs', practise letting them pass.\n\nTake your time with it — there's no right or wrong way. How do you feel afterwards?", { stage: "support", topic: "support_followup", techniqueGiven: "worry-time", sources: [{ slug: "worry-time", title: "Scheduled worry time" }] }],
      ]),
    },
    {
      id: "sample_voice_1",
      mode: "voice",
      title: "Evening check-in (sample)",
      createdAt: c2Start,
      updatedAt: c2Start + 6 * 45_000,
      sample: true,
      messages: msgs(c2Start, [
        ["assistant", "Hi, I'm Ari, an AI companion. It's nice to hear from you. How's your day going so far?", { stage: "intro", topic: "day", via: "voice" }],
        ["user", "Pretty good actually, I went for a long walk after work", { via: "voice" }],
        ["assistant", "Love that. What should I call you, if you'd like to share a name? No pressure at all.", { stage: "intro", topic: "name", via: "voice" }],
        ["user", "Alex", { via: "voice" }],
        ["assistant", "Lovely to meet you, Alex. When you get some free time, what do you like to do?", { stage: "lifestyle", topic: "free_time", via: "voice" }],
        ["user", "Walking, cooking, and I'm slowly learning guitar", { via: "voice" }],
        ["assistant", "Oh, guitar sounds great. How did you get into guitar?", { stage: "lifestyle", topic: "free_time", via: "voice" }],
      ]),
    },
  ];

  const pattern: [MoodEntry["mood"], MoodEntry["energy"], number, string[]][] = [
    [3, 3, 7, ["Work"]],
    [4, 4, 7.5, ["Friends", "Exercise"]],
    [3, 2, 6, ["Work", "Sleep"]],
    [2, 2, 5.5, ["Work", "Sleep"]],
    [3, 3, 6.5, ["Work"]],
    [4, 3, 7, ["Family"]],
    [4, 4, 8, ["Exercise", "Nature"]],
    [3, 3, 7, ["Work"]],
    [2, 2, 5, ["Work", "Sleep"]],
    [3, 3, 6.5, ["Friends"]],
    [4, 4, 7.5, ["Exercise"]],
    [5, 4, 8, ["Friends", "Nature"]],
    [4, 3, 7, ["Work"]],
  ];
  const moods: MoodEntry[] = pattern.map(([mood, energy, sleepHours, tags], i) => {
    const d = new Date(now - (pattern.length - i) * DAY);
    return { id: `sample_mood_${i}`, date: localDateKey(d), createdAt: d.getTime(), mood, energy, sleepHours, tags, sample: true };
  });
  return { conversations, moods };
}

export function loadSampleData() {
  const { conversations, moods } = buildSampleData();
  conversationsStore.update((list) => [...list.filter((c) => !c.sample), ...conversations].sort((a, b) => b.updatedAt - a.updatedAt));
  moodStore.update((list) => {
    const realDates = new Set(list.filter((m) => !m.sample).map((m) => m.date));
    return [...list.filter((m) => !m.sample), ...moods.filter((m) => !realDates.has(m.date))].sort((a, b) => a.date.localeCompare(b.date));
  });
}

export function removeSampleData() {
  conversationsStore.update((list) => list.filter((c) => !c.sample));
  moodStore.update((list) => list.filter((m) => !m.sample));
}
