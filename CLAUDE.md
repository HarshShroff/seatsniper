Here's the full execution plan. You have roughly 6 hours.

---

## Phase 1 — Firebase Setup (45 min)

**1.1 Create Firebase project (10 min)**
- Go to console.firebase.google.com → new project → "seatsniper-umbc"
- Enable Realtime Database (not Firestore — simpler for this)
- Set rules to public read/write for demo: `{".read": true, ".write": true}`
- Grab the config object (apiKey, databaseURL, etc.)

**1.2 Seed the database (15 min)**
Write a one-time `seed.js` script that:
- Reads `study_spots.json`
- Writes each spot to `/spots/{spot_id}` in Firebase
- Initializes `/spot_status/{spot_id}` with `{current_status: "unknown", last_reported: null, report_count: 0}`

Run it once, never again.

**1.3 Create `.env` (5 min)**
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_DATABASE_URL=...
VITE_GEMINI_API_KEY=...
```

**1.4 Install deps (5 min)**
```bash
npm install firebase @google/generative-ai
```

**1.5 `firebase.js` config file (10 min)**
Initialize app, export `db` reference. Done.

---

## Phase 2 — Core Availability Engine (1 hr)

This is the brain. One pure function, no API calls.

**`availability.js`** — write these functions:

```js
// Is a class running in this spot right now?
isOccupied(spot, now) 
// → checks spot.schedule, matches day + time window
// → returns {occupied: bool, course_name, ends_at}

// What's the next class in this spot today?
nextClass(spot, now)
// → returns {course_name, starts_at} or null if none today

// How long is the current free window?
freeUntil(spot, now)
// → returns time string like "2:30 PM" or "end of day"

// Master function — combines schedule + Firebase status
getSpotStatus(spot, liveStatus, now)
// → returns one of: "in_class" | "available" | "likely_free" | "unknown" | "closed"
// Priority: closed > in_class > crowdsourced > unknown
```

Day mapping: Firebase stores `["Mo","We"]` — map JS `Date.getDay()` to these.

Test this with hardcoded times before wiring to UI. This is the most logic-heavy part.

---

## Phase 3 — React App Structure (1 hr)

**Component tree:**
```
App
├── Header (logo, tagline, current time live clock)
├── QueryBar (Gemini natural language input)
├── SpotGrid
│   └── SpotCard × 28 (status dot, building, room, capacity, free-until, report buttons)
└── GeminiPanel (AI response display)
```

**`SpotCard` props:** spot data + live status from Firebase + computed availability

**Status dot colors:**
- 🟢 `available` — no class now, recently confirmed free
- 🟡 `likely_free` — no class now, no recent report
- 🔴 `in_class` — class running right now (from schedule, not crowdsource)
- ⚫ `unknown` — no class, no report in 30 min
- 🔒 `closed` — after 23:30

**Report buttons on each card:** "✅ Found a seat" | "❌ It's full" — writes to `/reports` and updates `/spot_status` in Firebase instantly.

**Live clock in header** — `setInterval` every minute, triggers re-computation of all statuses. This is the "wow" — judges watch the status change in real time.

---

## Phase 4 — Firebase Real-time Listener (30 min)

In `App.jsx`:
```js
// On mount — subscribe to live status updates
onValue(ref(db, 'spot_status'), (snapshot) => {
  setLiveStatuses(snapshot.val())
})
```

This is what makes reports from one browser tab instantly appear in another. **This is your live demo moment** — open two tabs, report from one, show the other updating instantly.

Report write logic:
```js
// On button click
push(ref(db, 'reports'), {spot_id, status, timestamp: Date.now()})
// Then update aggregated status
set(ref(db, `spot_status/${spot_id}`), {
  current_status: status,
  last_reported: Date.now(),
  report_count: increment(1)
})
```

Status expiry: if `Date.now() - last_reported > 30 * 60 * 1000` → treat as unknown. Compute this client-side, don't store it.

---

## Phase 5 — Gemini Integration (1 hr)

Two features, two prompts.

**Feature A — Natural Language Spot Finder**

User types: *"I need a quiet room near Engineering for 2 hours"*

Prompt structure:
```
You are SeatSniper, a campus study space assistant for UMBC.
Current time: {time}
Current day: {day}

Available spots right now (no class scheduled, recently confirmed or unknown):
{JSON.stringify(availableSpots.map(s => ({
  id: s.id,
  building: s.building,
  room: s.room,
  type: s.room_type,
  capacity: s.capacity,
  status: s.current_status,
  free_until: freeUntil(s, now)
})))}

User query: "{userQuery}"

Recommend the 2-3 best spots. For each: explain WHY it fits, mention free_until, note capacity. 
Be conversational, specific, and concise. No bullet points — talk like a helpful friend.
Return JSON: [{spot_id, building, room, reason, free_until}]
```

**Feature B — Schedule Gap Optimizer**

User pastes their schedule: *"CMSC 341 MWF 10-10:50, MATH 251 TuTh 1-2:15"*

Prompt:
```
You are a study gap optimizer for a UMBC student.
Today is {day}, current time is {time}.
Available study spots: {availableSpots summary}

Student's schedule today: "{schedule}"

Identify all gaps today longer than 30 minutes.
For each gap, recommend the best available spot and what type of work to do 
(review, problem sets, reading, etc.) based on gap length.
Be specific and practical. Return JSON: [{gap_start, gap_end, duration_min, spot_id, recommended_activity}]
```

Wire Feature A to the QueryBar. Feature B gets a separate "Plan My Day" button.

---

## Phase 6 — UI Polish (45 min)

Keep it minimal but sharp:
- Dark theme, UMBC gold accent (`#f0b429`) instead of generic colors
- Building filter pills at top (All | Fine Arts | Engineering | ITE | etc.)
- Sort toggle: "Available First" | "By Building"
- Mobile responsive — judges will check on phones
- Loading skeleton on Gemini response (don't just freeze)
- Timestamp on each card: "Last reported 4 min ago" or "No reports yet"

One animation worth adding: status dot pulses when `in_class` → `available` transition happens (class just ended). Purely CSS, 10 min, very satisfying to see live.

---

## Phase 7 — Demo Prep (30 min)

**Pre-seed a few reports** before the demo so it doesn't look empty:
```js
// Run this in browser console before presenting
// Sets 3-4 spots as "available" with timestamps from 5 min ago
```

**Demo script (practice this):**

1. Open app. Show the grid — red spots are in class RIGHT NOW based on the actual UMBC schedule. Green/yellow are free.
2. "Watch what happens when a class ends." Trigger a time change or wait for one — status flips automatically.
3. Open incognito tab. Report a spot as full. Show it turn red in the main tab instantly.
4. Type in QueryBar: "I have 45 minutes near Fine Arts, where should I go?" — show Gemini response.
5. Hit "Plan My Day" — paste a sample schedule — show the gap plan.

**That's 5 distinct wow moments in under 3 minutes.**

---

## Phase 8 — Submission (30 min)

- README: problem, tech stack, how to run, screenshots
- Devpost: fill every field, upload a screen recording if possible
- `.env.example` with placeholder keys
- Make sure `npm run build` works cleanly

---

## Time Budget

| Phase | Time |
|-------|------|
| Firebase setup | 45 min |
| Availability engine | 1 hr |
| React components | 1 hr |
| Firebase listeners | 30 min |
| Gemini integration | 1 hr |
| UI polish | 45 min |
| Demo prep | 30 min |
| Submission | 30 min |
| **Total** | **~6 hrs** |

---