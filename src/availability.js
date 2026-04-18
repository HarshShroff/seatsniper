import coursesData from '../umbc_courses.json'

export const DAY_MAP = { 0: 'Su', 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr', 6: 'Sa' }

// Pre-index courses by "building|room" for fast lookup, skip 'varies' entries
const COURSE_INDEX = {}
for (const c of coursesData.courses) {
  if (!c.building || c.building === 'varies' || !c.room || c.start === 'varies') continue
  const key = `${c.building}|${c.room}`
  if (!COURSE_INDEX[key]) COURSE_INDEX[key] = []
  COURSE_INDEX[key].push(c)
}

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

// booking: { booked_until: timestamp, session_id } | null
export function getSpotStatus(spot, booking, now = new Date()) {
  const mins = nowMinutes(now)
  if (mins >= toMinutes('23:30')) return 'closed'
  if (isOccupied(spot, now).occupied) return 'in_class'
  if (booking && booking.booked_until > now.getTime()) return 'taken'
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
