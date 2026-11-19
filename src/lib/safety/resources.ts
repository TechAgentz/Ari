/**
 * Crisis and support resources.
 * Numbers verified against the services' official information (as of Nov 2026).
 * Shown when a conversation indicates distress, and always on /support.
 */
export interface CrisisResource {
  region: string;
  name: string;
  description: string;
  actions: { label: string; href: string }[];
}

export const EMERGENCY_NUMBERS = [
  { region: "US & Canada", number: "911" },
  { region: "UK", number: "999" },
  { region: "EU", number: "112" },
  { region: "Australia", number: "000" },
  { region: "New Zealand", number: "111" },
  { region: "India", number: "112" },
] as const;

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    region: "United States",
    name: "988 Suicide & Crisis Lifeline",
    description: "Free, confidential, 24/7 support by call, text or chat.",
    actions: [
      { label: "Call 988", href: "tel:988" },
      { label: "Text 988", href: "sms:988" },
      { label: "Chat online", href: "https://988lifeline.org/" },
    ],
  },
  {
    region: "United States",
    name: "Crisis Text Line",
    description: "Text with a trained volunteer crisis counsellor, 24/7.",
    actions: [{ label: "Text HOME to 741741", href: "sms:741741?&body=HOME" }],
  },
  {
    region: "Canada",
    name: "9-8-8 Suicide Crisis Helpline",
    description: "Call or text 9-8-8, any time, in English or French.",
    actions: [
      { label: "Call 988", href: "tel:988" },
      { label: "Text 988", href: "sms:988" },
    ],
  },
  {
    region: "UK & Ireland",
    name: "Samaritans",
    description: "Free to call, 24/7, whatever you're going through.",
    actions: [{ label: "Call 116 123", href: "tel:116123" }],
  },
  {
    region: "UK",
    name: "Shout",
    description: "Free, confidential 24/7 text support.",
    actions: [{ label: "Text SHOUT to 85258", href: "sms:85258?&body=SHOUT" }],
  },
  {
    region: "Australia",
    name: "Lifeline Australia",
    description: "24/7 crisis support and suicide prevention.",
    actions: [{ label: "Call 13 11 14", href: "tel:131114" }],
  },
  {
    region: "New Zealand",
    name: "Need to Talk? 1737",
    description: "Free call or text, 24/7, with a trained counsellor.",
    actions: [
      { label: "Call 1737", href: "tel:1737" },
      { label: "Text 1737", href: "sms:1737" },
    ],
  },
  {
    region: "India",
    name: "Tele-MANAS",
    description: "Government of India 24/7 mental health helpline.",
    actions: [{ label: "Call 14416", href: "tel:14416" }],
  },
  {
    region: "Worldwide",
    name: "Find A Helpline",
    description: "Directory of free, confidential helplines in 130+ countries.",
    actions: [{ label: "findahelpline.com", href: "https://findahelpline.com/" }],
  },
];

export const ABUSE_RESOURCES: CrisisResource[] = [
  {
    region: "United States",
    name: "National Domestic Violence Hotline",
    description: "24/7, confidential support for anyone experiencing abuse.",
    actions: [
      { label: "Call 1-800-799-7233", href: "tel:18007997233" },
      { label: "Text START to 88788", href: "sms:88788?&body=START" },
    ],
  },
  {
    region: "UK",
    name: "National Domestic Abuse Helpline (Refuge)",
    description: "Free, 24/7, confidential.",
    actions: [{ label: "Call 0808 2000 247", href: "tel:08082000247" }],
  },
];
