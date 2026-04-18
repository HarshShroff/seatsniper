# SeatSniper

**Your campus. Your time. Never wasted.**

SeatSniper helps UMBC commuter students find available study spots in real time -- powered by crowdsourcing, live class schedules, and Gemini AI.

## Features

- **Live Stats Bar** -- real-time counter showing available/in-class/claimed spots
- **Live Spot Grid** -- 29 real UMBC rooms with schedule-aware availability
- **Crowdsourced Reports** -- one-tap seat availability updates instantly sync to all users
- **Gemini Spot Finder** -- natural language: "quiet spot near Engineering for 2 hours"
- **Gemini Gap Optimizer** -- paste your schedule, get a full study day plan with spot recommendations
- **Live Clock** -- statuses recompute every minute, spots flip when classes end
- **Vibe Check** -- AI predicts crowd/noise levels for both instant claims and advance bookings
- **Advance Booking** -- book a spot up to 7 days ahead, holds your spot until you arrive
- **Interactive Map** -- visual representation of campus buildings

## Stack

- React + Vite
- Firebase Realtime Database (live sync)
- Gemini 2.0 Flash API + UMBC Events API
- Pure CSS with UMBC gold accent

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
    Header.jsx       # Logo + live clock
    StatsBar.jsx      # Live stats counter
    QueryBar.jsx      # Find a spot / Plan my day tabs
    GeminiPanel.jsx   # AI response display
    SpotGrid.jsx     # Filter pills, sort toggle, grid
    SpotCard.jsx      # Individual spot: status, free-until, claim buttons
    BookingModal.jsx # Instant claim + advance booking with vibe check
    MapPanel.jsx      # Campus map
    MyBookings.jsx    # Advance bookings list
  study_spots.json    # 29 real UMBC rooms with schedules
  umbc_courses.json  # Course schedule data
  seed.js           # One-time Firebase seeder
```

## Status Indicators

- **Green** -- Available, confirmed free
- **Yellow** -- Likely free, no recent reports
- **Gold** -- In class right now (UMBC schedule)
- **Gray** -- Unknown or unchecked
- **Gold (Yours)** -- Your booked/claimed spot

## Demo Script

1. Open app -- gold spots are in class based on real UMBC schedule
2. Your claimed spots appear at the top
3. Open second tab, claim or book a spot -- watch it update in main tab instantly
4. Type in QueryBar: "I have 45 minutes near Fine Arts, where should I go?"
5. Hit "Plan My Day" -- paste a schedule -- see gap-by-gap study plan
6. Check the Stats Bar for real-time availability counts

## Adding New Spots

Add rooms to `study_spots.json` and courses to `umbc_courses.json`. Day codes must be short form: Mo, Tu, We, Th, Fr, Sa, Su.