import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, remove, push } from 'firebase/database'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from './firebase'
import { getSpotStatus, freeUntil, addMinutesToTime, formatDateKey, getSlotStatus } from './availability'
import { getEvents } from './sgaApi'
import Header from './components/Header'
import SpotGrid from './components/SpotGrid'
import QueryBar from './components/QueryBar'
import GeminiPanel from './components/GeminiPanel'
import MyBookings from './components/MyBookings'
import BookingModal from './components/BookingModal'
import spotsData from '../study_spots.json'
import coursesData from '../umbc_courses.json'

const SPOTS = spotsData.study_spots

// Pre-build course schedule context for Gemini plan prompt
const COURSE_SCHEDULE_CONTEXT = coursesData.courses
  .filter(c => c.building !== 'varies' && c.start !== 'varies' && c.room)
  .map(c => `${c.building} ${c.room}: ${c.days.join('/')} ${c.start}-${c.end} (${c.code})`)
  .join('\n')
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

  const [bookings, setBookings] = useState({})           // /bookings — active "right now" claims
  const [advanceBookings, setAdvanceBookings] = useState([]) // /advance_bookings — future reservations
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('available')
  const [geminiResponse, setGeminiResponse] = useState(null)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiMode, setGeminiMode] = useState('find')
  const [toast, setToast] = useState(null)
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [campusEvents, setCampusEvents] = useState([])
  const toastTimer = useRef(null)

  // Live "right now" bookings
  useEffect(() => {
    return onValue(ref(db, 'bookings'), (snap) => {
      const raw = snap.val() || {}
      const nowTs = Date.now()
      setBookings(Object.fromEntries(Object.entries(raw).filter(([, b]) => b.booked_until > nowTs)))
    })
  }, [])

  // Advance bookings — keep future ones only
  useEffect(() => {
    return onValue(ref(db, 'advance_bookings'), (snap) => {
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

  // ── Right Now claim ──
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
    showToast(`📍 Claimed! Auto-releases at ${endsAt}`)
  }

  async function handleRelease(spotId) {
    await remove(ref(db, `bookings/${spotId}`))
    showToast('✅ Spot released!')
  }

  // ── Advance claim ──
  async function handleClaimAhead(spot, date, startTime, durationMin) {
    // Guard: re-check conflict right before write (UI may be stale)
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
    showToast(`📅 Booked ${spot.display_name} on ${date} at ${startTime}`)
  }

  async function handleCancelAdvance(bookingId) {
    await remove(ref(db, `advance_bookings/${bookingId}`))
    showToast('❌ Booking cancelled')
  }

  function buildSpotContext() {
    return SPOTS
      .filter((s) => !['closed', 'in_class', 'taken'].includes(getSpotStatus(s, bookings[s.id], now)))
      .map((s) => ({
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

    const prompt = `You are a study gap optimizer for a UMBC commuter student.
Optimize ALL gaps across the student's FULL weekly schedule. Day runs 8:00 AM – 10:30 PM.

UMBC building map (use this for proximity matching):
- CMSC, CMPE, IS, CYBR → ITE building
- MATH, STAT → Math/Psychology building
- BIOL, BIOL → Biological Sciences
- CHEM → Chemistry building
- PHYS → Physics building
- ENGL, HIST, SOCY, POLI, PHIL, AFST → Sondheim Hall or PAHB
- PSYC → Math/Psychology building
- ECON, PUBL → Sondheim Hall
- Fine Arts, MUSC, THTR, ART → Fine Arts building

IMPORTANT: For each gap, pick a study spot IN OR NEAR the building where the surrounding classes are. If gap is between two classes in different buildings, pick a spot close to either. NEVER recommend a distant library just because it's big — prefer proximity to minimize travel.

Room occupation schedule (from UMBC course catalog — do NOT recommend a room if it has a class during the gap):
${COURSE_SCHEDULE_CONTEXT}

${eventsSnippet()}
Available study spots right now (noise_level: "silent"=no talking, "quiet"=whisper, "collaborative"=group OK):
${JSON.stringify(buildSpotContext())}

Student schedule: "${scheduleText}"

Schedule uses day codes: MWF = Mon/Wed/Fri, TuTh = Tue/Thu, M = Mon only, F = Fri only.

For EACH day that has classes (MWF days AND TuTh days), find all gaps > 30 min:
1. Gap before first class (from 8:00 AM) if > 30 min
2. Gaps between classes
3. Gap after last class until 10:30 PM if > 30 min

For each gap:
- Under 45 min: flashcards, review notes, quick reading — pick quiet spot nearby
- 45–90 min: problem sets, focused reading — pick quiet or collaborative spot nearby
- Over 90 min: deep work, projects, exam prep — pick any available spot nearby

Include a "day" field so results can be grouped. "End of day" = 10:30 PM always.
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
      <Header />

      <main className="main-content">
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
        />
      </main>

      {selectedSpot && (
        <BookingModal
          spot={selectedSpot}
          now={now}
          advanceBookings={advanceBookings}
          sessionId={sessionId}
          onClaimNow={handleClaimNow}
          onClaimAhead={handleClaimAhead}
          onClose={() => setSelectedSpot(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
