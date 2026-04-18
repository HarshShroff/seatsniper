import { getSpotStatus, isOccupied, freeUntil, formatBookedUntil } from '../availability'

const STATUS_CONFIG = {
  taken:    { label: 'Claimed',   cls: 'status-taken' },
  in_class:  { label: 'In Class', cls: 'status-in-class' },
  unknown:   { label: null,        cls: 'status-unknown' },  // default — no chip
  closed:    { label: 'Closed',   cls: 'status-closed' },
}

const ROOM_TYPE_LABELS = {
  large_classroom:  'Lecture Hall',
  classroom:        'Classroom',
  seminar_room:     'Seminar',
  lecture_hall:     'Lecture Hall',
  group_study:      'Group Study',
  individual_study: 'Individual',
  specialty:        'Specialty',
  open_lab:         'Open Lab',
  open:             'Open Area',
}

const NOISE_LABELS = {
  silent:        { label: 'Silent', cls: 'noise-silent' },
  quiet:         { label: 'Quiet',  cls: 'noise-quiet' },
  collaborative: { label: 'Collab', cls: 'noise-collab' },
}

export default function SpotCard({ spot, booking, sessionId, now, onSelect, selected, onRelease }) {
  const status = getSpotStatus(spot, booking, now)
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown
  const occupied = isOccupied(spot, now)
  const free = freeUntil(spot, now)
  const roomLabel = ROOM_TYPE_LABELS[spot.room_type] || spot.room_type
  const noiseBadge = spot.noise_level ? NOISE_LABELS[spot.noise_level] : null
  const isMyBooking = booking && booking.session_id === sessionId
  const bookedUntilStr = booking ? formatBookedUntil(booking.booked_until) : null
  const isSelectable = status !== 'closed' && status !== 'in_class' && !isMyBooking && status !== 'taken'
  const seatWord = spot.capacity === 1 ? 'seat' : 'seats'
  // Only show "free until" when there's a real next class (not end-of-day)
  const showFreeUntil = free && free !== '10:30 PM'

  return (
    <div
      className={`spot-card ${config.cls} ${selected ? 'selected' : ''}`}
      onClick={isSelectable ? () => onSelect(spot) : undefined}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      <div className="spot-card-header">
        <div className={`status-dot ${config.cls}`}></div>
        <div className="spot-info">
          <div className="spot-building">{spot.building}</div>
          <h3 className="spot-name">{spot.room}</h3>
        </div>
        <div className="spot-header-right">
          {isMyBooking && <span className="my-booking-badge">Yours</span>}
          {noiseBadge && (
            <span className={`noise-badge ${noiseBadge.cls}`}>{noiseBadge.label}</span>
          )}
        </div>
      </div>

      <div className="spot-meta">
        <span>{roomLabel}</span>
        <span className="meta-separator">·</span>
        <span>👤 {spot.capacity} {seatWord}</span>
      </div>

      {status === 'in_class' && occupied.occupied && (
        <div className="spot-detail in-class-detail">
          <span className="detail-label">Class ends</span>
          <span className="detail-value">{occupied.ends_at}</span>
        </div>
      )}

      {status === 'taken' && bookedUntilStr && (
        <div className="spot-detail">
          <span className="detail-label">{isMyBooking ? 'Releasing' : 'Free at'}</span>
          <span className={`detail-value ${!isMyBooking ? 'taken-until' : ''}`}>{bookedUntilStr}</span>
        </div>
      )}

      {status !== 'in_class' && status !== 'closed' && status !== 'taken' && showFreeUntil && (
        <div className="spot-detail">
          <span className="detail-label">Free until</span>
          <span className="detail-value">{free}</span>
        </div>
      )}

      {isMyBooking && (
        <button
          className="release-btn"
          onClick={(e) => { e.stopPropagation(); onRelease(spot.id) }}
        >
          Release
        </button>
      )}
    </div>
  )
}
