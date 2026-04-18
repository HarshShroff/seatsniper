import coursesData   from '../umbc_courses.json'
import scheduleData  from '../umbc_schedule.json'

export const DAY_MAP = { 0: 'Su', 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr', 6: 'Sa' }

// ── Day-name normalisation ──────────────────────────────────────────────────
// umbc_courses.json uses short codes: "Mo","Tu","We","Th","Fr"
// umbc_schedule.json uses full names: "Monday","Tuesday",…
const FULL_TO_SHORT = {
  Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We',
  Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su',
}

// Convert "2:30 pm" → "14:30"
function to24(timeStr) {
  if (!timeStr) return null
  const m = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = m[3].toLowerCase()
  if (ampm === 'pm' && h !== 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

// Parse "Fine Arts 006" → { building: "Fine Arts", room: "006" }
function parseLocation(loc) {
  if (!loc) return null
  // Known multi-word buildings
  const KNOWN = [
    'Fine Arts', 'Biological Sciences', 'Meyerhoff Chemistry',
    'Math & Psychology', 'Performing Arts', 'Sherman Hall',
    'AOK Library', 'Lecture Hall', 'Engineering', 'Sondheim',
    'ITE', 'ILS',
  ]
  for (const b of KNOWN) {
    if (loc.startsWith(b)) {
      const room = loc.slice(b.length).trim()
      return room ? { building: b, room } : null
    }
  }
  // Fallback: last token is room, rest is building
  const parts = loc.trim().split(/\s+/)
  if (parts.length < 2) return null
  return { building: parts.slice(0, -1).join(' '), room: parts[parts.length - 1] }
}

// ── Build unified COURSE_INDEX ──────────────────────────────────────────────
// Dedup key: building|room|day|start
const COURSE_INDEX = {}
const _seen = new Set()

function addCourse(building, room, days, start24, end24, code) {
  if (!building || building === 'varies' || !room || !start24 || start24 === 'varies') return
  const key = `${building}|${room}`
  if (!COURSE_INDEX[key]) COURSE_INDEX[key] = []
  for (const day of days) {
    const dedupKey = `${building}|${room}|${day}|${start24}`
    if (_seen.has(dedupKey)) continue
    _seen.add(dedupKey)
    COURSE_INDEX[key].push({ building, room, days: [day], start: start24, end: end24, code })
  }
}

// From umbc_courses.json (flat, short day codes)
for (const c of coursesData.courses) {
  addCourse(c.building, c.room, c.days, c.start, c.end, c.code)
}

// From umbc_schedule.json (nested sections, full day names, 12h times)
for (const course of scheduleData.courses) {
  for (const sec of (course.sections || [])) {
    if (sec.instruction_mode && sec.instruction_mode !== 'In Person') continue
    const loc = parseLocation(sec.location)
    if (!loc) continue
    const start24 = to24(sec.start_time)
    const end24   = to24(sec.end_time)
    if (!start24 || !end24) continue
    const shortDays = (sec.days || []).map(d => FULL_TO_SHORT[d]).filter(Boolean)
    addCourse(loc.building, loc.room, shortDays, start24, end24, course.course_code)
  }
}

// ── Export merged index for Gemini vibe forecast ───────────────────────────
export { COURSE_INDEX }

export function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function nowMinutes(date) {
  return date.getHours() * 60 + date.getMinutes()
}

// Check umbc_courses.json for a lecture running in this building+room right now
function courseOccupied(building, room, day, mins) {
  const courses = COURSE_INDEX[`${building}|${room}`] || []
  for (const c of courses) {
    if (!c.days.includes(day)) continue
    if (mins >= toMinutes(c.start) && mins < toMinutes(c.end)) {
      return { occupied: true, course_name: c.code, ends_at: c.end }
    }
  }
  return { occupied: false }
}

// Check umbc_courses.json for overlap with a time slot [slotMins, endMins)
function courseConflict(building, room, day, slotMins, endMins) {
  const courses = COURSE_INDEX[`${building}|${room}`] || []
  return courses.some(
    (c) => c.days.includes(day) && toMinutes(c.start) < endMins && toMinutes(c.end) > slotMins
  )
}

export function isOccupied(spot, now = new Date()) {
  const day = DAY_MAP[now.getDay()]
  const mins = nowMinutes(now)
  // Check course data from umbc_courses.json
  return courseOccupied(spot.building, spot.room, day, mins)
}

export function nextClass(spot, now = new Date()) {
  const day = DAY_MAP[now.getDay()]
  const mins = nowMinutes(now)
  const courses = COURSE_INDEX[`${spot.building}|${spot.room}`] || []

  const upcoming = courses
    .filter((c) => c.days.includes(day) && toMinutes(c.start) > mins)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))

  if (!upcoming.length) return null
  return {
    course_name: upcoming[0].code,
    starts_at: upcoming[0].start,
  }
}

export function freeUntil(spot, now = new Date()) {
  const next = nextClass(spot, now)
  if (!next) return '10:30 PM'
  const [h, m] = next.starts_at.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// booking: { booked_until: timestamp, session_id, last_reported? } | null
// Status priority: closed > in_class > taken > available > likely_free > unknown
export function getSpotStatus(spot, booking, now = new Date()) {
  const mins = nowMinutes(now)
  if (mins >= toMinutes('23:30')) return 'closed'
  if (isOccupied(spot, now).occupied) return 'in_class'
  if (booking && booking.booked_until > now.getTime()) return 'taken'

  // Crowdsource freshness: report within last 30 min → 'available', else 'unknown'
  if (booking && booking.last_reported) {
    const ageMin = (now.getTime() - booking.last_reported) / 60000
    return ageMin <= 30 ? 'available' : 'unknown'
  }

  return 'unknown'
}

export function formatBookedUntil(bookedUntil) {
  if (!bookedUntil) return ''
  return new Date(bookedUntil).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── ADVANCE BOOKING HELPERS ──

export function formatDateKey(dateObj) {
  return dateObj.toISOString().split('T')[0] // "2026-04-19"
}

export function addMinutesToTime(timeStr, mins) {
  const total = toMinutes(timeStr) + mins
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function fmt12(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Returns: 'past' | 'class' | 'booked' | 'mine' | 'free'
export function getSlotStatus(spot, dateObj, slotTime, durationMin, advanceBookings, sessionId) {
  const day = DAY_MAP[dateObj.getDay()]
  const slotMins = toMinutes(slotTime)
  const endMins = slotMins + durationMin

  // Past slots (only for today)
  const now = new Date()
  const isToday = dateObj.toDateString() === now.toDateString()
  if (isToday && slotMins <= nowMinutes(now)) return 'past'

  // Class conflict — check course data + spot's own schedule
  if (courseConflict(spot.building, spot.room, day, slotMins, endMins)) return 'class'

  // Advance booking conflict
  const dateKey = formatDateKey(dateObj)
  const hit = advanceBookings.find(
    (b) =>
      b.spot_id === spot.id &&
      b.date === dateKey &&
      toMinutes(b.start_time) < endMins &&
      toMinutes(b.end_time) > slotMins
  )
  if (hit) return hit.session_id === sessionId ? 'mine' : 'booked'

  return 'free'
}

export function generateTimeSlots() {
  const slots = []
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 22 && m > 0) break
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots // "07:00" … "22:00"
}

export function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}
