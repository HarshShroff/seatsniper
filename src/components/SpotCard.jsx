import { getSpotStatus, isOccupied, freeUntil, formatBookedUntil } from '../availability'

const ROOM_TYPE_LABELS = {
  large_classroom:  'Lecture Hall',
  classroom:        'Classroom',
  seminar_room:     'Seminar Room',
  lecture_hall:     'Lecture Hall',
  group_study:      'Group Study',
  individual_study: 'Individual Study',
  specialty:        'Specialty',
  open_lab:         'Open Lab',
  open:             'Open Area',
}

const NOISE_LABELS = {
  silent:        { label: 'Silent',   cls: 'noise-silent' },
  quiet:         { label: 'Quiet',    cls: 'noise-quiet' },
  collaborative: { label: 'Collab',   cls: 'noise-collab' },
}

const STATUS_BADGE = {
  available:   { label: 'Available',   cls: 'badge-available' },
  unknown:     { label: 'Check it',    cls: 'badge-unknown' },
  taken:       { label: 'Claimed',     cls: 'badge-taken' },
  in_class:    { label: 'In Class',    cls: 'badge-in_class' },
  closed:      { label: 'Closed',      cls: 'badge-closed' },
}

export default function SpotCard({
  spot, booking, sessionId, now, onSelect, selected, onRelease, onHover,
  vibeForecast, onVibeForecast,
}) {
  const status = getSpotStatus(spot, booking, now)
  const badge = STATUS_BADGE[status] || STATUS_BADGE.unknown
  const occupied = isOccupied(spot, now)
  const free = freeUntil(spot, now)
  const roomLabel = ROOM_TYPE_LABELS[spot.room_type] || spot.room_type
  const noiseBadge = spot.noise_level ? NOISE_LABELS[spot.noise_level] : null
  const isMyBooking = booking && booking.session_id === sessionId
  const bookedUntilStr = booking ? formatBookedUntil(booking.booked_until) : null
  const isSelectable = status !== 'closed' && status !== 'in_class' && !isMyBooking && status !== 'taken'
  const seatWord = spot.capacity === 1 ? 'seat' : 'seats'
  const showFreeUntil = free && free !== '10:30 PM'

  // Hero stat text
  let heroLabel = 'Free until'
  let heroValue = showFreeUntil ? free : 'All day'
  let heroClass = ''
  if (status === 'in_class') {
    heroLabel = 'Class ends'
    heroValue = occupied.ends_at || '—'
    heroClass = 'busy'
  } else if (status === 'taken') {
    heroLabel = isMyBooking ? 'Releasing at' : 'Free at'
    heroValue = bookedUntilStr || '—'
    heroClass = 'taken'
  } else if (status === 'closed') {
    heroLabel = 'Opens at'
    heroValue = '7:00 AM'
    heroClass = 'busy'
  }

  return (
    <div
      className={`spot-card status-${status} ${selected ? 'selected' : ''}`}
      onClick={isSelectable ? () => onSelect(spot) : undefined}
      onMouseEnter={onHover ? () => onHover(spot.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      {/* Color band */}
      <div className="spot-card-banner" />

      <div className="spot-card-body">
        <div className="spot-card-top">
          <div className="spot-card-title">
            <div className="spot-building">{spot.building}</div>
            <h3 className="spot-name">{spot.display_name || spot.room}</h3>
          </div>
          <div className="spot-badges">
            {isMyBooking && <span className="my-booking-badge">Yours</span>}
            <span className={`status-badge ${badge.cls}`}>{badge.label}</span>
            {noiseBadge && (
              <span className={`noise-badge ${noiseBadge.cls}`}>{noiseBadge.label}</span>
            )}
          </div>
        </div>

        {/* Hero stat */}
        <div className="spot-hero-stat">
          <span className="hero-label">{heroLabel}</span>
          <span className={`hero-value ${heroClass}`}>{heroValue}</span>
        </div>

        {/* Meta row */}
        <div className="spot-meta-row">
          <span>{roomLabel}</span>
          <span className="meta-dot" />
          <span>{spot.capacity} {seatWord}</span>
        </div>

        {/* Vibe forecast result */}
        {vibeForecast?.text && (
          <div className="vibe-forecast">
            <span className="vibe-text">{vibeForecast.text}</span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="spot-card-footer">
        {isMyBooking ? (
          <button
            className="release-btn"
            onClick={e => { e.stopPropagation(); onRelease(spot.id) }}
          >
            Release spot
          </button>
        ) : isSelectable ? (
          <button
            className="book-now-btn"
            onClick={e => { e.stopPropagation(); onSelect(spot) }}
          >
            Book
          </button>
        ) : null}

        {status !== 'closed' && onVibeForecast && (
          <button
            className="vibe-btn"
            onClick={e => { e.stopPropagation(); onVibeForecast(spot) }}
            disabled={vibeForecast?.loading}
            title="AI crowd prediction for the next 2 hours"
          >
            {vibeForecast?.loading
              ? <span className="spinner" style={{ width: 10, height: 10, borderTopColor: '#7C3AED' }} />
              : 'Vibe'
            }
          </button>
        )}
      </div>
    </div>
  )
}
