import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, remove, push } from 'firebase/database'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from './firebase'
import { getSpotStatus, freeUntil, addMinutesToTime, formatDateKey, getSlotStatus, COURSE_INDEX, DAY_MAP, toMinutes } from './availability'
import { getEvents } from './sgaApi'
import Header from './components/Header'
import StatsBar from './components/StatsBar'
import SpotGrid from './components/SpotGrid'
import QueryBar from './components/QueryBar'
import GeminiPanel from './components/GeminiPanel'
import MyBookings from './components/MyBookings'
import MapPanel from './MapPanel'
import BookingModal from './components/BookingModal'
import spotsData from '../study_spots.json'
import scheduleData from '../umbc_schedule.json'

const SPOTS = spotsData.study_spots

// Build COURSE_SCHEDULE_CONTEXT from the richer umbc_schedule.json
const COURSE_SCHEDULE_CONTEXT = scheduleData.courses.flatMap(course =>
  (course.sections || [])
    .filter(s => s.location && s.start_time && s.days?.length)
    .map(s => `${s.location}: ${s.days.join('/')} ${s.start_time}-${s.end_time} (${course.course_code})`)
).join('\n')

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

function getSessionId() {
  let id = sessionStorage.getItem('ss_session')
  if (!id) {
    id = `anon_${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem('ss_session', id)
  }
  return id
}

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function App() {
  const now = useNow()
  const sessionId = useRef(getSessionId()).current

  const [bookings, setBookings] = useState({})
  const [advanceBookings, setAdvanceBookings] = useState([])
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('available')
  const [geminiResponse, setGeminiResponse] = useState(null)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiMode, setGeminiMode] = useState('find')
  const [toast, setToast] = useState(null)
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [campusEvents, setCampusEvents] = useState([])
  const [hoveredSpotId, setHoveredSpotId] = useState(null)

  // QueryBar (Plan My Day) state
  const [planMode, setPlanMode] = useState(false)

  // Map collapse state
  const [mapCollapsed, setMapCollapsed] = useState(false)

  // Vibe forecast: { [spotId]: { loading, text } }
  const [vibeForecasts, setVibeForecasts] = useState({})

  // Advance vibe check: { loading, text } — reset each time a new slot is checked
  const [vibeAhead, setVibeAhead] = useState({ loading: false, text: null })

  const toastTimer = useRef(null)

  // Live "right now" bookings
  useEffect(() => {
    return onValue(ref(db, 'bookings'), snap => {
      const raw = snap.val() || {}
      const nowTs = Date.now()
      setBookings(Object.fromEntries(
        Object.entries(raw).filter(([, b]) => b.booked_until > nowTs)
      ))
    })
  }, [])

  // Advance bookings
  useEffect(() => {
    return onValue(ref(db, 'advance_bookings'), snap => {
      const raw = snap.val() || {}
      const today = formatDateKey(new Date())
      const future = Object.entries(raw)
        .filter(([, b]) => b.date >= today)
        .map(([id, b]) => ({ ...b, _id: id }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      setAdvanceBookings(future)
    })
  }, [])

  useEffect(() => {
    getEvents().then(setCampusEvents)
  }, [])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  async function handleClaimNow(spotId, durationMin) {
    const bookedUntil = Date.now() + durationMin * 60 * 1000
    await set(ref(db, `bookings/${spotId}`), {
      spot_id: spotId,
      session_id: sessionId,
      duration_min: durationMin,
      claimed_at: Date.now(),
      booked_until: bookedUntil,
    })
    const endsAt = new Date(bookedUntil).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    showToast(`Claimed! Auto-releases at ${endsAt}`)
  }

  async function handleRelease(spotId) {
    await remove(ref(db, `bookings/${spotId}`))
    showToast('Spot released!')
  }

  async function handleClaimAhead(spot, date, startTime, durationMin) {
    const dateObj = new Date(date + 'T00:00:00')
    const conflict = getSlotStatus(spot, dateObj, startTime, durationMin, advanceBookings, sessionId)
    if (conflict === 'class' || conflict === 'booked') {
      showToast('⚠️ Slot no longer available — pick another time')
      return
    }
    const endTime = addMinutesToTime(startTime, durationMin)
    await push(ref(db, 'advance_bookings'), {
      spot_id: spot.id,
      spot_display_name: spot.display_name,
      building: spot.building,
      room: spot.room,
      date,
      start_time: startTime,
      end_time: endTime,
      duration_min: durationMin,
      session_id: sessionId,
      created_at: Date.now(),
    })
    showToast(`Booked on ${date} at ${startTime}`)
  }

  async function handleCancelAdvance(bookingId) {
    await remove(ref(db, `advance_bookings/${bookingId}`))
    showToast('Booking cancelled')
  }

  async function handleVibeAhead(spot, date, startTime, durationMin) {
    setVibeAhead({ loading: true, text: null })

    const day = DAY_MAP[new Date(date + 'T00:00:00').getDay()]
    const slotMins  = toMinutes(startTime)
    const slotEnd   = slotMins + durationMin

    // Classes that overlap the booked window in this building
    const buildingClasses = Object.entries(COURSE_INDEX)
      .filter(([key]) => key.startsWith(spot.building + '|'))
      .flatMap(([, courses]) => courses)
      .filter(c => {
        if (!c.days.includes(day)) return false
        const cs = toMinutes(c.start), ce = toMinutes(c.end)
        return cs < slotEnd && ce > slotMins   // any overlap
      })
      .map(c => `${c.building} ${c.room}: ${c.code} ${c.start}–${c.end}`)

    const dateObj = new Date(date + 'T00:00:00')
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const prompt = `You are SeatSniper, a UMBC study space assistant.
The student wants to book: ${spot.building} ${spot.room} (${spot.display_name}).
Room type: ${spot.room_type}, noise level: ${spot.noise_level}, capacity: ${spot.capacity}.
Booking window: ${startTime}–${addMinutesToTime(startTime, durationMin)} on ${dateStr}.

Classes running in this building during that window:
${buildingClasses.length ? buildingClasses.join('\n') : 'No classes scheduled in this building during that window.'}

Give a 1-sentence vibe prediction for this specific room during the booking window. Mention if hallways will be busy, if it'll be quiet, or if classes nearby will cause noise. Max 20 words. No fluff.
Return JSON: {"vibe": "your one sentence here"}`

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      })
      const data = JSON.parse(result.response.text())
      setVibeAhead({ loading: false, text: data.vibe || 'Should be a good window.' })
    } catch (err) {
      console.error('Vibe ahead error:', err)
      setVibeAhead({ loading: false, text: 'Could not load forecast.' })
    }
  }

  async function handleVibeForecast(spot) {
    // Already loaded or loading
    if (vibeForecasts[spot.id]?.text || vibeForecasts[spot.id]?.loading) return

    setVibeForecasts(prev => ({ ...prev, [spot.id]: { loading: true, text: null } }))

    const day = DAY_MAP[now.getDay()]
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const windowEnd = nowMins + 120 // next 2 hours

    // Get all classes in this building in the next 2 hours
    const buildingClasses = Object.entries(COURSE_INDEX)
      .filter(([key]) => key.startsWith(spot.building + '|'))
      .flatMap(([, courses]) => courses)
      .filter(c => c.days.includes(day) && toMinutes(c.start) >= nowMins && toMinutes(c.start) < windowEnd)
      .map(c => `${c.building} ${c.room}: ${c.code} at ${c.start}–${c.end}`)

    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const prompt = `You are SeatSniper, a UMBC study space assistant. Current time: ${timeStr}, ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]}.

The student is considering studying at: ${spot.building} ${spot.room} (${spot.display_name}).
Room type: ${spot.room_type}, noise level: ${spot.noise_level}, capacity: ${spot.capacity}.

Upcoming classes in this building in the next 2 hours:
${buildingClasses.length ? buildingClasses.join('\n') : 'No classes scheduled in this building for the next 2 hours.'}

Give a 1-sentence crowd/noise vibe prediction for this specific room right now. Be direct and specific — mention if it'll get busy soon, if the hallway will be loud, or if it's a good quiet window. Max 20 words. No fluff.
Return JSON: {"vibe": "your one sentence here"}`

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      })
      const data = JSON.parse(result.response.text())
      setVibeForecasts(prev => ({ ...prev, [spot.id]: { loading: false, text: data.vibe || 'Looks quiet right now.' } }))
    } catch (err) {
      console.error('Vibe forecast error:', err)
      setVibeForecasts(prev => ({ ...prev, [spot.id]: { loading: false, text: 'Could not load forecast.' } }))
    }
  }

  function buildSpotContext() {
    return SPOTS
      .filter(s => !['closed', 'in_class', 'taken'].includes(getSpotStatus(s, bookings[s.id], now)))
      .map(s => ({
        id: s.id,
        building: s.building,
        room: s.room,
        type: s.room_type,
        capacity: s.capacity,
        noise_level: s.noise_level ?? 'collaborative',
        free_until: freeUntil(s, now),
      }))
  }

  function eventsSnippet() {
    if (!campusEvents.length) return ''
    return `Campus events today:\n${campusEvents.slice(0, 5).map(e =>
      `- ${e.title}${e.location ? ` @ ${e.location}` : ''}`
    ).join('\n')}\n`
  }

  async function callGemini(prompt) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
    return JSON.parse(result.response.text())
  }

  async function handleQuery(query) {
    setGeminiMode('find')
    setGeminiLoading(true)
    setGeminiResponse(null)
    setPlanMode(false)

    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' })

    const prompt = `You are SeatSniper, a UMBC campus study space assistant.
Current time: ${timeStr}, ${dayStr}
${eventsSnippet()}
Available spots (not in class, not claimed):
${JSON.stringify(buildSpotContext())}

User query: "${query}"

Recommend 2-3 best spots. For each explain WHY it fits the request.
noise_level: "silent"=absolutely no talking, "quiet"=whisper only, "collaborative"=group work fine.
Return JSON array only: [{"spot_id":"...","building":"...","room":"...","reason":"...","free_until":"..."}]`

    try {
      setGeminiResponse(await callGemini(prompt))
    } catch (err) {
      console.error('Gemini error:', err)
      setGeminiResponse('Could not get recommendations. Check console.')
    } finally {
      setGeminiLoading(false)
    }
  }

  async function handlePlanDay(scheduleText) {
    setGeminiMode('plan')
    setGeminiLoading(true)
    setGeminiResponse(null)
    setPlanMode(true)

    const prompt = `You are a study gap optimizer for a UMBC commuter student.
Optimize ALL gaps across the student's FULL weekly schedule. Day runs 8:00 AM – 10:30 PM.

UMBC building map (use this for proximity matching):
- CMSC, CMPE, IS, CYBR → ITE building
- MATH, STAT → Math & Psychology building
- BIOL → Biological Sciences
- CHEM → Meyerhoff Chemistry
- PHYS → Engineering
- ENGL, HIST, SOCY, POLI, PHIL → Sondheim Hall
- PSYC → Math & Psychology building
- ECON, PUBL → Sondheim Hall
- Fine Arts, MUSC, THTR, ART → Fine Arts building

Room occupation schedule (do NOT recommend a room if it has a class during the gap):
${COURSE_SCHEDULE_CONTEXT}

${eventsSnippet()}
Available study spots right now:
${JSON.stringify(buildSpotContext())}

Student schedule: "${scheduleText}"

Schedule day codes: MWF = Mon/Wed/Fri, TuTh = Tue/Thu, M = Mon only, F = Fri only.

For EACH day that has classes, find all gaps > 30 min:
1. Gap before first class (from 8:00 AM) if > 30 min
2. Gaps between classes
3. Gap after last class until 10:30 PM if > 30 min

For each gap pick a spot IN OR NEAR the surrounding class buildings.
Include a "day" field. "End of day" = 10:30 PM always.
Return JSON array: [{"day":"Monday","gap_start":"H:MM AM/PM","gap_end":"H:MM AM/PM","duration_min":N,"spot_id":"...","building":"...","room":"...","recommended_activity":"..."}]`

    try {
      setGeminiResponse(await callGemini(prompt))
    } catch (err) {
      console.error('Gemini error:', err)
      setGeminiResponse('Could not analyze schedule. Check console.')
    } finally {
      setGeminiLoading(false)
    }
  }

  return (
    <div className="app">
      <Header now={now} />
      <StatsBar spots={SPOTS} bookings={bookings} now={now} />

      <div className={`layout${mapCollapsed ? ' map-collapsed' : ''}`}>
        <main className="main">
          {/* Map toggle button — floats at top-right of the main column */}
          <div className="map-toggle-wrapper">
            <button
              onClick={() => setMapCollapsed(c => !c)}
              title={mapCollapsed ? 'Show map' : 'Hide map'}
            >
              {mapCollapsed ? 'Map' : 'Close'}
            </button>
          </div>

          {/* Plan My Day bar — shown below header */}
          <QueryBar onQuery={handleQuery} onPlanDay={handlePlanDay} loading={geminiLoading} />

          <GeminiPanel
            response={geminiResponse}
            loading={geminiLoading}
            mode={geminiMode}
            spots={SPOTS}
            onBookSpot={setSelectedSpot}
          />

          <MyBookings
            advanceBookings={advanceBookings}
            sessionId={sessionId}
            onCancel={handleCancelAdvance}
          />

          <SpotGrid
            spots={SPOTS}
            bookings={bookings}
            sessionId={sessionId}
            now={now}
            onSelect={setSelectedSpot}
            selectedSpot={selectedSpot}
            onRelease={handleRelease}
            filter={filter}
            sort={sort}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onHover={setHoveredSpotId}
            vibeForecasts={vibeForecasts}
            onVibeForecast={handleVibeForecast}
          />
        </main>

        <aside className="sidebar">
          <MapPanel
            spots={SPOTS}
            selectedSpot={selectedSpot}
            hoveredSpotId={hoveredSpotId}
            onSelect={setSelectedSpot}
          />
        </aside>
      </div>

      {selectedSpot && (
        <BookingModal
          spot={selectedSpot}
          now={now}
          advanceBookings={advanceBookings}
          sessionId={sessionId}
          onClaimNow={handleClaimNow}
          onClaimAhead={handleClaimAhead}
          vibeAhead={vibeAhead}
          onVibeAhead={handleVibeAhead}
          onClose={() => { setSelectedSpot(null); setVibeAhead({ loading: false, text: null }) }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
