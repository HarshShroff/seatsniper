import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Exact GPS coordinates extracted from official Google Maps links
const BUILDINGS = [
  { name: 'Biological Sciences', lat: 39.2547497, lng: -76.7121881, label: 'Bio Sci' },
  { name: 'ITE',                 lat: 39.2538015, lng: -76.7142732, label: 'ITE' },
  { name: 'Engineering',         lat: 39.2545409, lng: -76.7139862, label: 'Engineering' },
  { name: 'ILS',                 lat: 39.2539082, lng: -76.7111874, label: 'ILS' },
  { name: 'Performing Arts',     lat: 39.2551137, lng: -76.7152222, label: 'Perf Arts' },
  { name: 'Fine Arts',           lat: 39.2549564, lng: -76.7139405, label: 'Fine Arts' },
  { name: 'Lecture Hall 1',      lat: 39.2548212, lng: -76.7117931, label: 'Lec Hall 1' },
  { name: 'Math & Psychology',   lat: 39.2540976, lng: -76.7124787, label: 'Math/Psych' },
  { name: 'Meyerhoff Chemistry', lat: 39.2548993, lng: -76.7131032, label: 'Chemistry' },
  { name: 'Sherman Hall',        lat: 39.2535534, lng: -76.7136518, label: 'Sherman' },
  { name: 'Sondheim',            lat: 39.2533894, lng: -76.7128633, label: 'Sondheim' },
  { name: 'AOK Library',         lat: 39.2563038, lng: -76.7115496, label: 'AOK Library' },
]

// UMBC campus center (Hilltop Circle area)
const UMBC_CENTER = [39.2549, -76.7108]

// Custom SVG pin icons
function makeIcon(color, size = 28) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.27 21.73 0 14 0z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [size, Math.round(size * 1.4)],
    iconAnchor: [size / 2, Math.round(size * 1.4)],
    popupAnchor:[0, -Math.round(size * 1.4)],
  })
}

const ICON_DEFAULT     = makeIcon('#888888')
const ICON_HIGHLIGHTED = makeIcon('#FF385C', 34)

// Fly to highlighted building when it changes
function FlyTo({ building }) {
  const map = useMap()
  useEffect(() => {
    if (!building) return
    const b = BUILDINGS.find(b => b.name === building)
    if (b) map.flyTo([b.lat, b.lng], 17, { duration: 0.7 })
  }, [building, map])
  return null
}

export default function UmbcMap({ highlightedBuilding, onBuildingClick }) {
  return (
    <MapContainer
      center={UMBC_CENTER}
      zoom={16}
      zoomControl={true}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%', borderRadius: '0' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FlyTo building={highlightedBuilding} />

      {BUILDINGS.map(b => {
        const isHighlighted = highlightedBuilding === b.name
        return (
          <Marker
            key={b.name}
            position={[b.lat, b.lng]}
            icon={isHighlighted ? ICON_HIGHLIGHTED : ICON_DEFAULT}
            eventHandlers={{
              click: () => onBuildingClick && onBuildingClick(b.name),
            }}
          >
            <Popup>
              <strong style={{ fontFamily: 'Inter, sans-serif' }}>{b.label}</strong>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
