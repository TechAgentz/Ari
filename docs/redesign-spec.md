# Haven redesign: friendly and easy to use

Goal: someone who has never used the app, possibly anxious and on a phone, should be talking to Ari within 5 seconds and never wonder where to tap. Every screen has **one obvious main action**, plain words, big touch targets, and calm visuals.

The guiding standard is "Accessible & Ethical" (WCAG AA minimum, AAA where practical): calm, warm, rounded and uncluttered.

## Principles

1. **One primary action per screen**: one big, filled button. Everything else is quieter (outline or text).
2. **Plain words**: no jargon or internal terms ("stage", "provider", "context window", "fallback") in main UI. Short sentences, written in the second person ("you").
3. **Big and touchable**: touch targets at least 48px, primary buttons 56px tall on phones, body text 16–17px, at least 8px between targets.
4. **Less on screen**: progressive disclosure. Secondary details go behind "More", "Show transcript" or "How it works" disclosures, not on the first view.
5. **Calm motion**: 150–300ms ease-out, one or two animated elements per view, respect `prefers-reduced-motion`.
6. **Always safe**: the "Get help" (crisis) entry is visible on every screen. Crisis cards and consent flows keep their behaviour exactly.
7. **Honest identity**: Ari is described with `APP.role` ("virtual care assistant") and `APP.careTeam`. Never "AI companion", never "psychologist" for Ari.

## Visual language

- **Light theme is the default** for new visitors (warm and friendly). Dark theme stays available in Settings and must look equally good.
- **Palette (light):**
  - warm off-white background `#F7F5F0`, white surfaces;
  - deep calm teal primary `#0E7C74` (white text on it);
  - soft lavender accent `#7C6FD6`;
  - warm peach highlight `#F2A86B` (decoration only, never text on white);
  - text `#1F2D2B`, muted text `#55605E` (≥4.5:1 on background);
  - borders `#E6E1D8`.
- **Palette (dark):** deep blue-green background `#0E1716`, surfaces `#16211F`, primary `#6FD1C3`, text `#E8F0EE`, muted `#A9BAB7`.
- **Shapes:**
  - cards: 24px radius, 1px border, very soft shadow;
  - buttons: fully rounded (pill);
  - icons: Lucide only, 2px stroke, 20–24px.
- **Type:**
  - Lora (serif) for page titles only, Inter for everything else;
  - page title 28px on phones / 36px on desktop;
  - section title 18px semibold; body 16–17px, line-height 1.6.
- **Spacing:** 4/8px rhythm; 20px phone gutters; 24–32px between sections.
- **Illustration:** the existing soft orb gradient is the brand mark of Ari. Reuse it (small, as an avatar) instead of new imagery. No emoji as icons.

## Navigation

- **Phone bottom tab bar: 4 tabs**, each with icon and label:
  - **Home** (`/`)
  - **Talk** (`/voice`): voice first, with an obvious "Type instead" switch to `/chat`
  - **Exercises** (`/library`)
  - **Mood** (`/mood`)

  `/chat` highlights the Talk tab.
- **Phone top bar:**
  - left: logo and app name;
  - right: a **"Get help"** pill (danger-soft) and a **menu button** (labelled "More", icon `Menu`).
  - The menu opens a bottom sheet with **Past conversations** (`/history`), **Settings** (`/settings`), **Crisis support** (`/support`), a theme toggle, and the short honesty note.
- **Desktop (≥1024px):** left sidebar with the same items as text plus icons: Home, Talk, Chat, Exercises, Mood, Past conversations, Settings. "Need help now?" card at the bottom.
- All existing routes keep working (deep links).

## Screens

### Home (`/`)
1. Greeting ("Good evening" plus the name if known), then the title "How can I help today?". Below it, one short line: "I'm Ari, your virtual care assistant. I work alongside your psychologist."
2. **Hero action**: a large round mic button (about 120px, orb gradient, gentle breathing animation) labelled **"Tap to talk"**. Under it, a text link: "Prefer typing? Chat instead".
3. **Quick check-in**: "How are you feeling?" with 5 large face buttons in one row (Rough, Low, Okay, Good, Great). Tapping one goes to `/mood?mood=…` as today.
4. **Continue**: if a recent conversation exists, one card "Continue your last conversation" with its date and a "Continue" button.
5. **Try this now**: a single "Today's calming exercise" card (existing practice-of-the-day).
6. **Explore** grid: exactly 6 simple tiles, 2 columns on phones and 3 on desktop: Talk, Chat, Exercises, Mood check-in, Past conversations, Crisis support. These are the 6 dashboard entries from the original spec. Each tile has an icon, a title and one short line.
7. Keep the `?notice=demo` banner behaviour.

### Talk / Voice (`/voice`)
- **Before starting:**
  - large orb, title "Talk with Ari", and one sentence: "Speak naturally. Pause when you're done and Ari will reply."
  - one huge **Start talking** button;
  - a quiet "Type instead" link;
  - a collapsible **"How voice works"** with the microphone and voice details now shown in the info box;
  - the provider badge sits small inside that disclosure.
- **During a session:**
  - **status pill**: "Listening…", "Thinking…" or "Ari is speaking";
  - the **orb** in the centre, with Ari's latest sentence shown large underneath as a caption (2–3 lines);
  - your live words shown smaller while you speak;
  - **3 big labelled controls** in a bottom bar: **Mute**, **Interrupt / Send now** (context-dependent, as today), and **End** (danger-soft);
  - the voice on/off toggle and "Type instead" move into a small "More" row;
  - the full transcript sits behind a "Show transcript" button (a sheet on phones, a side panel on desktop);
  - the timer is small.
- **Ended:** a friendly summary card with "View transcript", "Talk again" and "Home".
- Keep all keyboard shortcuts, aria-live regions, crisis cards, check-in notices, errors and permission retry flows.

### Chat (`/chat`)
- Header: Ari avatar (small orb), "Ari" with "Virtual care assistant" underneath, plus a "New chat" icon button with a label for screen readers and a "Talk by voice" button. Remove the stage-progress bar from the header.
- Bubbles:
  - user bubbles: primary colour, right-aligned;
  - Ari bubbles: white surface, left-aligned, with the avatar;
  - 16–17px text and a comfortable max width.
- Suggestion chips appear only before the first user message, and wrap instead of scrolling sideways.
- Composer: large rounded input (at least 52px tall), a clear send button (48px) and a mic dictation button.
- Footer note in one line: "Ari is a virtual care assistant, not a psychologist. In crisis? Get help now".
- The privacy pill becomes a single small line at the top of the conversation.

### Exercises (`/library`)
- Title "Exercises & guides". A search field, then category filter chips. Results are big cards with an icon, the title, the duration and one line. The breathing pacer and articles keep working.

### Mood (`/mood`)
- Big 5-face picker, an optional note, and a big "Save check-in" button. Below: "Your week", shown as the existing chart with a short plain-language summary, then recent entries.

### Past conversations (`/history`), Settings (`/settings`), Crisis support (`/support`)
- History: search plus simple list rows (title, date, preview), with "Continue" and "Delete" (confirm) actions.
- Settings: grouped list sections like iOS settings (Voice, Privacy, Appearance, Your data, About), keeping every existing control. Plain labels.
- Support: crisis numbers as large tappable `tel:` cards at the top, with the calmest, clearest layout. This page must stay fast and simple.

### Onboarding dialog
- A friendlier, shorter welcome:
  - Ari's orb avatar, then "Hi, I'm Ari";
  - 3 short bullets with icons: virtual care assistant (not a psychologist, not for emergencies); conversations stay in this browser; replies are generated by Groq;
  - the optional checkboxes;
  - one big "Agree and start" button (sticky on phones), with a small note underneath.

## Must not change

- Data stores, consent logic, safety and crisis logic, the voice controller and API routes.
- Exported component names and props that pages import.
- Accessibility: focus rings, skip link, labels, aria-live regions.
- Honest identity copy (`APP.role` and `APP.careTeam`).
- Tests (`npm test`) must keep passing.
