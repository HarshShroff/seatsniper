import { useState } from 'react'
import { freeUntil, getNext7Days, generateTimeSlots, getSlotStatus, fmt12, addMinutesToTime, formatDateKey } from '../availability'

const NOW_DURATIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '90 min', value: 90 },
  { label: '2 hours', value: 120 },
]

const AHEAD_DURATIONS = [30, 60, 90, 120]

const SLOT_LEGEND = {
  free:   { cls: 'slot-free',   label: 'Free' },
  past:   { cls: 'slot-past',   label: 'Past' },
  class:  { cls: 'slot-class',  label: 'Class' },
  booked: { cls: 'slot-booked', label: 'Booked' },
  mine:   { cls: 'slot-mine',   label: 'Yours' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function dateLabel(d, i) {
  if (i === 0) return 'Today'
  if (i === 1) return 'Tomorrow'
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export default function BookingModal({ spot, now, advanceBookings, sessionId, onClaimNow, onClaimAhead, onClose }) {
  const [tab, setTab] = useState('now')
  const [nowDuration, setNowDuration] = useState(60)
  const [nowLoading, setNowLoading] = useState(false)

  const dates = getNext7Days()
  const slots = generateTimeSlots()
  const [selectedDate, setSelectedDate] = useState(dates[0])
  const [selectedTime, setSelectedTime] = useState(null)
  const [aheadDuration, setAheadDuration] = useState(60)
  const [aheadLoading, setAheadLoading] = useState(false)

  const free = freeUntil(spot, now)

  async function handleClaimNow() {
    setNowLoading(true)
    await onClaimNow(spot.id, nowDuration)
    onClose()
  }

  async function handleClaimAhead() {
    if (!selectedTime) return
    setAheadLoading(true)
    await onClaimAhead(spot, formatDateKey(selectedDate), selectedTime, aheadDuration)
    onClose()
  }

  function slotStatusForSelected(slotTime) {
    return getSlotStatus(spot, selectedDate, slotTime, aheadDuration, advanceBookings, sessionId)
  }

  const selectedConflict = selectedTime
    ? ['class', 'booked'].includes(slotStatusForSelected(selectedTime))
    : false

  const canBook = selectedTime && !selectedConflict

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-spot-name">{spot.display_name}</h2>
            <p className="modal-spot-meta">
              {spot.room_type?.replace(/_/g, ' ')} · cap {spot.capacity}
              {spot.noise_level ? ` · ${spot.noise_level}` : ''}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${tab === 'now' ? 'active' : ''}`} onClick={() => setTab('now')}>
            Right Now
          </button>
          <button className={`modal-tab ${tab === 'ahead' ? 'active' : ''}`} onClick={() => setTab('ahead')}>
            Book in Advance
          </button>
        </div>

        {tab === 'now' && (
          <div className="modal-body">
            {free !== '10:30 PM' && (
              <p className="modal-free-until">Free until {free}</p>
            )}
            <p className="modal-label">How long?</p>
            <div className="modal-durations">
              {NOW_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  className={`duration-btn ${nowDuration === d.value ? 'active' : ''}`}
                  onClick={() => setNowDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button className="claim-btn" onClick={handleClaimNow} disabled={nowLoading}>
              {nowLoading ? 'Claiming...' : `Claim for ${NOW_DURATIONS.find(d => d.value === nowDuration)?.label}`}
            </button>
            <p className="modal-note">Auto-releases when time expires. No login needed.</p>
          </div>
        )}

        {tab === 'ahead' && (
          <div className="modal-body">
            <p className="modal-label">Select date</p>
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

            <p className="modal-label">Duration</p>
            <div className="ahead-durations">
              {AHEAD_DURATIONS.map((min) => (
                <button
                  key={min}
                  className={`dur-chip ${aheadDuration === min ? 'active' : ''}`}
                  onClick={() => { setAheadDuration(min); setSelectedTime(null) }}
                >
                  {min < 60 ? `${min}m` : `${min / 60}h`}
                </button>
              ))}
            </div>

            <p className="modal-label">Start time</p>
            <div className="slot-legend">
              {Object.entries(SLOT_LEGEND).map(([k, v]) => (
                <span key={k} className={`legend-dot ${v.cls}`}>{v.label}</span>
              ))}
            </div>
            <div className="slot-grid">
              {slots.map((slotTime) => {
                const st = slotStatusForSelected(slotTime)
                const isSelected = selectedTime === slotTime
                const disabled = st === 'past' || st === 'class' || st === 'booked'
                return (
                  <button
                    key={slotTime}
                    className={`slot-btn ${SLOT_LEGEND[st]?.cls ?? ''} ${isSelected ? 'slot-selected' : ''}`}
                    disabled={disabled}
                    onClick={() => setSelectedTime(isSelected ? null : slotTime)}
                    title={st === 'class' ? 'Class running' : st === 'booked' ? 'Already booked' : fmt12(slotTime)}
                  >
                    {fmt12(slotTime)}
                  </button>
                )
              })}
            </div>

            {selectedTime && (
              <div className="selected-summary">
                <strong>{fmt12(selectedTime)}</strong> – <strong>{fmt12(addMinutesToTime(selectedTime, aheadDuration))}</strong>
                {' '}· {dateLabel(selectedDate, dates.findIndex(d => formatDateKey(d) === formatDateKey(selectedDate)))}
              </div>
            )}

            <button className="claim-btn" onClick={handleClaimAhead} disabled={!canBook || aheadLoading}>
              {aheadLoading ? 'Booking...' : canBook ? 'Confirm Booking' : 'Select a time slot'}
            </button>
            <p className="modal-note">Advance bookings hold the spot. Cancel anytime in My Bookings.</p>
          </div>
        )}
      </div>
    </div>
  )
}
