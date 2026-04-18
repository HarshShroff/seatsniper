import { useState, useEffect } from 'react'
import { getTransitArrivals, getTransitStops, getTransitRoutes } from '../sgaApi'

const REFRESH_MS = 60000

function formatMinutes(seconds) {
  if (seconds == null) return '—'
  const min = Math.round(seconds / 60)
  if (min <= 0) return 'NOW'
  if (min === 1) return '1 min'
  return `${min} min`
}

export default function TransitPanel() {
  const [arrivals, setArrivals] = useState([])
  const [stops, setStops] = useState({})
  const [routes, setRoutes] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  async function load() {
    try {
      const [arrivalsData, stopsData, routesData] = await Promise.all([
        getTransitArrivals(),
        getTransitStops(),
        getTransitRoutes(),
      ])

      const stopMap = {}
      const stopArr = Array.isArray(stopsData) ? stopsData : stopsData?.data ?? []
      stopArr.forEach((s) => { stopMap[s.stop_id ?? s.id] = s })

      const routeMap = {}
      const routeArr = Array.isArray(routesData) ? routesData : routesData?.data ?? []
      routeArr.forEach((r) => { routeMap[r.route_id ?? r.id] = r })

      const arr = Array.isArray(arrivalsData) ? arrivalsData : arrivalsData?.data ?? []
      setArrivals(arr)
      setStops(stopMap)
      setRoutes(routeMap)
    } catch {
      // silent fail — transit is bonus feature
    } finally {
      setLoading(false)
    }
  }

  const visible = expanded ? arrivals : arrivals.slice(0, 4)

  if (!loading && arrivals.length === 0) return null

  return (
    <div className="transit-panel">
      <div className="transit-header" onClick={() => setExpanded(!expanded)}>
        <div className="transit-title">
          <span>🚌</span>
          <span>Live Transit</span>
        </div>
        <span className="transit-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {loading && <div className="transit-loading">Loading arrivals...</div>}

      {!loading && (
        <div className="transit-list">
          {visible.map((arrival, i) => {
            const stopId = arrival.stop_id ?? arrival.stopId
            const routeId = arrival.route_id ?? arrival.routeId
            const stop = stops[stopId]
            const route = routes[routeId]
            const etas = arrival.arrivals ?? arrival.arrival_estimates ?? []
            const nextEta = etas[0]

            return (
              <div key={i} className="transit-row">
                <div
                  className="transit-route-badge"
                  style={{ background: route?.color ? `#${route.color}` : '#f0b429' }}
                >
                  {route?.short_name ?? routeId ?? '?'}
                </div>
                <div className="transit-info">
                  <span className="transit-stop">{stop?.name ?? `Stop ${stopId}`}</span>
                  {route?.long_name && (
                    <span className="transit-route-name">{route.long_name}</span>
                  )}
                </div>
                <div className="transit-eta">
                  {nextEta
                    ? formatMinutes(nextEta.seconds_to_arrival ?? nextEta.secondsToArrival)
                    : '—'}
                </div>
              </div>
            )
          })}

          {arrivals.length > 4 && (
            <button className="transit-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Show less' : `+${arrivals.length - 4} more stops`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
