export default function GeminiPanel({ response, loading, mode, spots, onBookSpot }) {
  if (!loading && !response) return null

  return (
    <div className="gemini-panel">
      <div className="gemini-panel-header">
        <span className="gemini-label">Gemini</span>
        <span className="gemini-title">
          {mode === 'plan' ? 'Study Day Plan' : 'Recommendations'}
        </span>
      </div>

      {loading && (
        <div className="gemini-loading">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <p>Analyzing live spot data...</p>
        </div>
      )}

      {!loading && response && (
        <div className="gemini-response">
          {mode === 'plan'
            ? <PlanView plan={response} spots={spots} onBookSpot={onBookSpot} />
            : <FindView recs={response} spots={spots} onBookSpot={onBookSpot} />
          }
        </div>
      )}
    </div>
  )
}

function FindView({ recs, spots, onBookSpot }) {
  if (typeof recs === 'string') return <p className="gemini-text">{recs}</p>
  if (!Array.isArray(recs) || !recs.length) return <p className="gemini-text">No spots found matching your query.</p>
  return (
    <div className="rec-list">
      {recs.map((rec, i) => {
        const spot = spots?.find(s => s.id === rec.spot_id)
        return (
          <div key={i} className="rec-card">
            <div className="rec-rank">0{i + 1}</div>
            <div className="rec-content" style={{ flex: 1, minWidth: 0 }}>
              <h4 className="rec-spot">{rec.building} {rec.room}</h4>
              <p className="rec-reason">{rec.reason}</p>
              {rec.free_until && (
                <span className="rec-free">Free until {rec.free_until}</span>
              )}
            </div>
            {spot && onBookSpot && (
              <button className="rec-book-btn" onClick={() => onBookSpot(spot)}>
                Book
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function PlanView({ plan, spots, onBookSpot }) {
  if (typeof plan === 'string') return <p className="gemini-text">{plan}</p>
  if (!Array.isArray(plan) || !plan.length) return <p className="gemini-text">No gaps found in your schedule.</p>

  const valid = plan.filter(g => g.building && g.gap_start && g.gap_end && g.duration_min > 0)
  if (!valid.length) return <p className="gemini-text">No productive gaps found.</p>

  const hasDays = valid.some(g => g.day)
  if (!hasDays) {
    return (
      <div className="plan-list">
        {valid.map((gap, i) => <GapCard key={i} gap={gap} spots={spots} onBookSpot={onBookSpot} />)}
      </div>
    )
  }

  const grouped = {}
  for (const g of valid) {
    const d = g.day || 'Other'
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(g)
  }
  const days = DAY_ORDER.filter(d => grouped[d]).concat(
    Object.keys(grouped).filter(d => !DAY_ORDER.includes(d))
  )

  return (
    <div className="plan-list">
      {days.map(day => (
        <div key={day} className="plan-day-group">
          <div className="plan-day-label">{day}</div>
          {grouped[day].map((gap, i) => (
            <GapCard key={i} gap={gap} spots={spots} onBookSpot={onBookSpot} />
          ))}
        </div>
      ))}
    </div>
  )
}

function GapCard({ gap, spots, onBookSpot }) {
  const spot = spots?.find(s => s.id === gap.spot_id)
  return (
    <div className="plan-gap">
      <div className="plan-time">
        {gap.gap_start} – {gap.gap_end}
        <span className="plan-duration">{gap.duration_min}m</span>
      </div>
      <div className="plan-spot">{gap.building} {gap.room}</div>
      {spot && onBookSpot && (
        <button className="plan-book-btn" onClick={() => onBookSpot(spot)}>
          Book
        </button>
      )}
    </div>
  )
}
