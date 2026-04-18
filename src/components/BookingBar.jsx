import { useState } from 'react'
import { freeUntil, getNext7Days, generateTimeSlots, getSlotStatus, fmt12, addMinutesToTime, formatDateKey } from '../availability'

const AHEAD_DURATIONS = [30, 60, 90, 120]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SLOT_LEGEND = {
  free:   { cls: 'slot-free',   label: 'Free' },
  past:   { cls: 'slot-past',   label: 'Past' },
  class:  { cls: 'slot-class',  label: 'Class' },
  booked: { cls: 'slot-booked', label: 'Taken' },
  mine:   { cls: 'slot-mine',   label: 'Yours' },
}

const DUR_LABELS = { 30: '30m', 60: '1h', 90: '1.5h', 120: '2h' }

function dateLabel(d, i) {
  if (i === 0) return 'Today'
  if (i === 1) return 'Tomorrow'
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export default function BookingBar({ spot, now, advanceBookings, sessionId, onClaimNow, onClaimAhead, onClear }) {
  const [tab, setTab] = useState('now')
  const [nowDuration, setNowDuration] = useState(60)
  const [nowLoading, setNowLoading] = useState(false)

  const dates = getNext7Days()
  const slots = generateTimeSlots()
  const [selectedDate, setSelectedDate] = useState(dates[0])
  const [selectedTime, setSelectedTime] = useState(null)
  const [aheadDuration, setAheadDuration] = useState(60)
  const [aheadLoading, setAheadLoading] = useState(false)

  async function handleNow() {
    setNowLoading(true)
    await onClaimNow(spot.id, nowDuration)
    setNowLoading(false)
  }

  async function handleAhead() {
    if (!selectedTime) return
    setAheadLoading(true)
    await onClaimAhead(spot, formatDateKey(selectedDate), selectedTime, aheadDuration)
    setAheadLoading(false)
    setSelectedTime(null)
  }

  function slotStatus(slotTime) {
    return getSlotStatus(spot, selectedDate, slotTime, aheadDuration, advanceBookings, sessionId)
  }

  const conflict = selectedTime ? ['class', 'booked'].includes(slotStatus(selectedTime)) : false
  const canBook = selectedTime && !conflict
  const free = spot ? freeUntil(spot, now) : null

  if (!spot) {
    return (
      <div className="booking-bar">
        <div className="booking-bar-empty">
          <div className="booking-bar-empty-top">
            <div className="booking-bar-empty-icon">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <p>Click any spot from the grid to book it</p>
            <small>Right now or up to 7 days ahead</small>
          </div>
          <div className="bb-legend">
            <div className="bb-legend-title">Status guide</div>
            <div className="bb-legend-items">
              <div className="bb-legend-item"><span className="bb-legend-bar free"/><span>Available — click to book</span></div>
              <div className="bb-legend-item"><span className="bb-legend-bar busy"/><span>In Class — check back later</span></div>
              <div className="bb-legend-item"><span className="bb-legend-bar taken"/><span>Claimed by someone</span></div>
              <div className="bb-legend-item"><span className="bb-legend-bar closed"/><span>Closed for the day</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-bar">
      <div className="bb-header">
        <div>
          <div className="bb-spot-name">{spot.display_name}</div>
          <div className="bb-spot-meta">
            {spot.room_type?.replace(/_/g, ' ')} · cap {spot.capacity}
            {spot.noise_level ? ` · ${spot.noise_level}` : ''}
          </div>
        </div>
        <button className="bb-close" onClick={onClear}>×</button>
      </div>

      <div className="bb-tabs">
        <button className={`bb-tab ${tab === 'now' ? 'active' : ''}`} onClick={() => setTab('now')}>
          Right Now
        </button>
        <button className={`bb-tab ${tab === 'ahead' ? 'active' : ''}`} onClick={() => setTab('ahead')}>
          Book in Advance
        </button>
      </div>

      {tab === 'now' && (
        <div className="bb-body">
          {free && free !== '10:30 PM' && (
            <div className="bb-free-until">Free until {free}</div>
          )}

          <div>
            <span className="bb-label">Duration</span>
            <div className="dur-grid">
              {AHEAD_DURATIONS.map(m => (
                <button
                  key={m}
                  className={`dur-btn ${nowDuration === m ? 'active' : ''}`}
                  onClick={() => setNowDuration(m)}
                >
                  {DUR_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <button className="book-btn" onClick={handleNow} disabled={nowLoading}>
            {nowLoading ? 'Claiming...' : `Claim for ${DUR_LABELS[nowDuration]}`}
          </button>
          <p className="bb-note">Auto-releases when time expires. No login needed.</p>
        </div>
      )}

      {tab === 'ahead' && (
        <div className="bb-body">
          <div>
            <span className="bb-label">Select date</span>
            <div className="date-carousel">
              {dates.map((d, i) => (
                <button
                  key={i}
                  className={`date-chip ${formatDateKey(selectedDate) === formatDateKey(d) ? 'active' : ''}`}
                  onClick={() => { setSelectedDate(d); setSelectedTime(null) }}
                >
                  {dateLabel(d, i)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="bb-label">Duration</span>
            <div className="ahead-durations">
              {AHEAD_DURATIONS.map(m => (
                <button
                  key={m}
                  className={`adur-chip ${aheadDuration === m ? 'active' : ''}`}
                  onClick={() => { setAheadDuration(m); setSelectedTime(null) }}
                >
                  {DUR_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="bb-label">Start time</span>
            <div className="slot-legend">
              {Object.entries(SLOT_LEGEND).map(([k, v]) => (
                <span key={k} className={`legend-dot ${v.cls}`}>{v.label}</span>
              ))}
            </div>
            <div className="slot-grid" style={{ marginTop: 6 }}>
              {slots.map(slotTime => {
                const st = slotStatus(slotTime)
                const isSel = selectedTime === slotTime
                const disabled = st === 'past' || st === 'class' || st === 'booked'
                return (
                  <button
                    key={slotTime}
                    className={`slot-btn ${SLOT_LEGEND[st]?.cls ?? ''} ${isSel ? 'slot-selected' : ''}`}
                    disabled={disabled}
                    onClick={() => setSelectedTime(isSel ? null : slotTime)}
                    title={fmt12(slotTime)}
                  >
                    {fmt12(slotTime)}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedTime && (
            <div className="selected-summary">
              {fmt12(selectedTime)} – {fmt12(addMinutesToTime(selectedTime, aheadDuration))}
              {' · '}{dateLabel(selectedDate, dates.findIndex(d => formatDateKey(d) === formatDateKey(selectedDate)))}
            </div>
          )}

          <button className="book-btn" onClick={handleAhead} disabled={!canBook || aheadLoading}>
            {aheadLoading ? 'Booking...' : canBook ? 'Confirm Booking' : 'Select a time slot'}
          </button>
          <p className="bb-note">Cancel anytime from My Bookings.</p>
        </div>
      )}
    </div>
  )
}
