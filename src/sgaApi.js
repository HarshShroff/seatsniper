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
