const BASE = 'https://api.sga.umbc.edu'

async function fetchXml(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  const text = await res.text()
  const parser = new DOMParser()
  return parser.parseFromString(text, 'application/xml')
}

export async function getEvents() {
  try {
    const doc = await fetchXml('/events')
    const items = Array.from(doc.querySelectorAll('item'))
    if (!items.length) return []
    return items.slice(0, 10).map((item) => ({
      title: item.querySelector('title')?.textContent ?? '',
      description: item.querySelector('description')?.textContent ?? '',
      start: item.querySelector('start')?.textContent ?? item.querySelector('pubDate')?.textContent ?? '',
      location: item.querySelector('location')?.textContent ?? '',
    }))
  } catch {
    return []
  }
}

// ── Transit API (TransitTrack / Transloc) ──
// UMBC uses a Transloc-compatible feed. These return empty arrays gracefully
// if the endpoint is unavailable so TransitPanel fails silently.

export async function getTransitArrivals() {
  try {
    const res = await fetch(`${BASE}/transit/arrivals`)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : json?.data ?? []
  } catch {
    return []
  }
}

export async function getTransitStops() {
  try {
    const res = await fetch(`${BASE}/transit/stops`)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : json?.data ?? []
  } catch {
    return []
  }
}

export async function getTransitRoutes() {
  try {
    const res = await fetch(`${BASE}/transit/routes`)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : json?.data ?? []
  } catch {
    return []
  }
}
