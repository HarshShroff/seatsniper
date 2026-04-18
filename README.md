# 🎯 SeatSniper AI

**Your campus. Your time. Never wasted.**

SeatSniper helps UMBC commuter students find available study spots in real time — powered by crowdsourcing, live class schedules, and Gemini AI.

## Features

- **Live Spot Grid** — 28 real UMBC rooms with schedule-aware availability (green/yellow/red)
- **Crowdsourced Reports** — one-tap "Found a seat" / "It's full" updates Firebase instantly, visible to everyone
- **Gemini Spot Finder** — natural language: *"quiet spot near Engineering for 2 hours"*
- **Gemini Gap Optimizer** — paste your schedule, get a full study day plan with spot recommendations per gap
- **Live Clock** — statuses recompute every minute, status dots flip automatically when classes end

## Stack

- React + Vite
- Firebase Realtime Database (live sync)
- Gemini 2.0 Flash API + SGA UMBC Events API
- Pure CSS dark theme with UMBC gold

## Setup

```bash
# 1. Clone + install
npm install

# 2. Create Firebase project at console.firebase.google.com
#    Enable Realtime Database, set rules to public read/write for demo:
#    { ".read": true, ".write": true }

# 3. Create .env from template
cp .env.example .env
# Fill in Firebase config + Gemini API key

# 4. Seed the database (run once)
node seed.js

# 5. Run dev server
npm run dev
```

## Project Structure

```
src/
  availability.js     # Core logic: schedule checking, status computation
  firebase.js         # Firebase init
  App.jsx             # Root: Firebase listeners, Gemini calls, state
  components/
    Header.jsx        # Logo + live clock
    QueryBar.jsx      # Find a spot / Plan my day tabs
    GeminiPanel.jsx   # AI response display
    SpotGrid.jsx      # Filter pills, sort toggle, grid
    SpotCard.jsx      # Individual spot: status, free-until, report buttons
study_spots.json      # 28 real UMBC rooms with Spring 2026 schedules
seed.js               # One-time Firebase seeder
```

## Demo Script

1. Open app — red spots are in class **right now** based on real UMBC schedule
2. Open incognito tab, report a spot as full → watch it update in main tab instantly
3. Type in QueryBar: *"I have 45 minutes near Fine Arts, where should I go?"*
4. Hit "Plan My Day" → paste a schedule → see gap-by-gap study plan
