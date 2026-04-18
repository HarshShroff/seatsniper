import UmbcMap from './UmbcMap'

export default function MapPanel({ spots, selectedSpot, hoveredSpotId, onSelect }) {
  const hoveredSpot = hoveredSpotId ? spots.find((s) => s.id === hoveredSpotId) : null

  // The selected spot takes precedence for highlighting
  const highlightedBuilding = selectedSpot?.building || hoveredSpot?.building

  function handleMapClick(buildingName) {
    // Find the first available spot in that building and select it
    const firstSpotInBuilding = spots.find(s => s.building === buildingName);
    if (firstSpotInBuilding) {
      onSelect(firstSpotInBuilding);
    }
  }

  return (
    <div className="map-container">
      <UmbcMap highlightedBuilding={highlightedBuilding} onBuildingClick={handleMapClick} />
    </div>
  )
}