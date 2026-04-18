import SpotCard from './SpotCard'
import { getSpotStatus } from '../availability'

const STATUS_ORDER = { available: 0, unknown: 1, taken: 2, in_class: 3, closed: 4 }
const ALL = 'All'

const BUILDING_SHORT = {
  'Biological Sciences': 'Bio Sci',
  'Fine Arts':           'Fine Arts',
  'Lecture Hall 1':      'Lec Hall',
  'Math & Psychology':   'Math/Psych',
  'Meyerhoff Chemistry': 'Chemistry',
  'Performing Arts':     'Perf Arts',
  'Sherman Hall':        'Sherman',
  'AOK Library':         'Library',
}

function shortLabel(b) {
  return b === ALL ? 'All' : (BUILDING_SHORT[b] || b)
}

export default function SpotGrid({
  spots, bookings, sessionId, now,
  onSelect, selectedSpot, onRelease,
  filter, sort, onFilterChange, onSortChange,
  onHover, vibeForecasts, onVibeForecast,
}) {
  const buildings = [ALL, ...new Set(spots.map(s => s.building))]

  const filtered = spots
    .filter(s => filter === ALL || s.building === filter)
    .sort((a, b) => {
      if (sort === 'available') {
        const sa = getSpotStatus(a, bookings[a.id], now)
        const sb = getSpotStatus(b, bookings[b.id], now)
        return (STATUS_ORDER[sa] ?? 99) - (STATUS_ORDER[sb] ?? 99)
      }
      return a.building.localeCompare(b.building)
    })

  const availableCount = spots.filter(s =>
    ['available', 'unknown'].includes(getSpotStatus(s, bookings[s.id], now))
  ).length

  return (
    <section className="spot-grid-section">
      <div className="grid-controls">
        <div className="grid-controls-left">
          <div className="grid-count">
            <span className="count-num">{availableCount}</span>
            <span className="count-label">&nbsp;spots open</span>
          </div>
          <div className="filter-pills">
            {buildings.map(b => (
              <button
                key={b}
                className={`filter-pill ${filter === b ? 'active' : ''}`}
                onClick={() => onFilterChange(b)}
              >
                {shortLabel(b)}
              </button>
            ))}
          </div>
        </div>
        <div className="sort-toggle">
          <button
            className={`sort-btn ${sort === 'available' ? 'active' : ''}`}
            onClick={() => onSortChange('available')}
          >
            Available first
          </button>
          <button
            className={`sort-btn ${sort === 'building' ? 'active' : ''}`}
            onClick={() => onSortChange('building')}
          >
            By building
          </button>
        </div>
      </div>

      <div className="spot-grid">
        {filtered.map(spot => (
          <SpotCard
            key={spot.id}
            spot={spot}
            booking={bookings[spot.id] || null}
            sessionId={sessionId}
            now={now}
            onSelect={onSelect}
            selected={selectedSpot?.id === spot.id}
            onRelease={onRelease}
            onHover={onHover}
            vibeForecast={vibeForecasts?.[spot.id]}
            onVibeForecast={onVibeForecast}
          />
        ))}
      </div>
    </section>
  )
}
