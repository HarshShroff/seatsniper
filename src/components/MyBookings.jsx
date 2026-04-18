import { useState } from 'react'
import { fmt12 } from '../availability'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateDisplay(dateStr) {
  const d = parseDate(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return `${DAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export default function MyBookings({ advanceBookings, sessionId, onCancel }) {
  const [open, setOpen] = useState(true)

  const mine = advanceBookings
    .filter((b) => b.session_id === sessionId)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.start_time.localeCompare(b.start_time)
    })

  if (!mine.length) return null

  return (
    <div className="my-bookings-panel">
      <div className="my-bookings-header" onClick={() => setOpen(!open)}>
        <div className="my-bookings-title">
          <span>My Bookings</span>
          <span className="my-bookings-count">{mine.length}</span>
        </div>
        <span className="my-bookings-toggle">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="my-bookings-list">
          {mine.map((b) => (
            <div key={b._id} className="my-booking-row">
              <div className="my-booking-info">
                <span className="my-booking-spot">{b.spot_display_name}</span>
                <span className="my-booking-time">
                  {formatDateDisplay(b.date)} · {fmt12(b.start_time)} – {fmt12(b.end_time)}
                </span>
              </div>
              <button className="cancel-booking-btn" onClick={() => onCancel(b._id)}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
