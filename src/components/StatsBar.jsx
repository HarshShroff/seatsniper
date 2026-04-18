import { getSpotStatus, isOccupied } from '../availability'
import { useEffect, useState } from 'react'

export default function StatsBar({ spots, bookings = {}, now }) {
  const [nextEnds, setNextEnds] = useState(null)

  const available = spots.filter(s => {
    const status = getSpotStatus(s, bookings[s.id], now)
    return status === 'available' || status === 'likely_free'
  }).length
  const inClass = spots.filter(s => getSpotStatus(s, bookings[s.id], now) === 'in_class').length
  const taken = spots.filter(s => getSpotStatus(s, bookings[s.id], now) === 'taken').length

  useEffect(() => {
    let nextClass = null
    let minEnd = Infinity
    for (const spot of spots) {
      if (bookings[spot.id]?.booked_until > now.getTime()) continue
      const occ = isOccupied(spot, now)
      if (occ && occ.ends_at) {
        const [h, m] = occ.ends_at.replace(' PM', '').replace(' AM', '').split(':').map(Number)
        const isPM = occ.ends_at.includes('PM') && !occ.ends_at.includes('12')
        const endMin = (isPM && h !== 12 ? h + 12 : h) * 60 + m
        if (endMin < minEnd) {
          minEnd = endMin
          nextClass = { spot: spot.display_name, endsAt: occ.ends_at }
        }
      }
    }
    setNextEnds(nextClass)
  }, [now])

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-value stat-free">{available}</span>
        <span className="stat-label">Available</span>
      </div>
      <div className="stat-divider">|</div>
      <div className="stat-item">
        <span className="stat-value stat-busy">{inClass}</span>
        <span className="stat-label">In Class</span>
      </div>
      <div className="stat-divider">|</div>
      <div className="stat-item">
        <span className="stat-value stat-taken">{taken}</span>
        <span className="stat-label">Claimed</span>
      </div>
      {nextEnds && (
        <>
          <div className="stat-divider">|</div>
          <div className="stat-item">
            <span className="stat-next">
              Next free: {nextEnds.spot} at {nextEnds.endsAt}
            </span>
          </div>
        </>
      )}
    </div>
  )
}