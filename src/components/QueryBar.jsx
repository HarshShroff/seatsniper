import { useState } from 'react'

const SAMPLE_SCHEDULES = [
  'CMSC 341 MWF 10-10:50am, MATH 251 TuTh 1-2:15pm, CMSC 202 MWF 2-2:50pm, IS 310 TuTh 10-11:15am',
  'BIOL 141 TuTh 8:30-9:45am, CHEM 101 MWF 9-9:50am, PHYS 121 TuTh 1-2:15pm, ENGL 100 MWF 12-12:50pm',
  'HIST 101 MWF 11-11:50am, PSYC 100 TuTh 11:30-12:45pm, SOCY 101 MWF 2-2:50pm, ECON 101 TuTh 2:30-3:45pm',
]

const SAMPLE_QUERIES = [
  'Quiet spot near Engineering for 2 hours',
  'Group study room for 4 people right now',
  'Silent space for exam prep this afternoon',
]

export default function QueryBar({ onQuery, onPlanDay, loading }) {
  const [query, setQuery] = useState('')
  const [schedule, setSchedule] = useState('')
  const [mode, setMode] = useState('find')

  function handleFind(e) {
    e.preventDefault()
    if (!query.trim()) return
    onQuery(query.trim())
  }

  function handlePlan(e) {
    e.preventDefault()
    if (!schedule.trim()) return
    onPlanDay(schedule.trim())
  }

  return (
    <div className="query-bar">
      <div className="query-tabs">
        <button
          className={`query-tab ${mode === 'find' ? 'active' : ''}`}
          onClick={() => setMode('find')}
        >
          Find a Spot
        </button>
        <button
          className={`query-tab ${mode === 'plan' ? 'active' : ''}`}
          onClick={() => setMode('plan')}
        >
          Plan My Day
        </button>
      </div>

      {mode === 'find' && (
        <div className="query-form-wrap">
          <form className="query-form" onSubmit={handleFind}>
            <input
              className="query-input"
              type="text"
              placeholder='e.g. "Quiet spot near Engineering for 2 hours"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <button className="query-submit" type="submit" disabled={loading || !query.trim()}>
              {loading ? <span className="spinner" /> : 'Ask Gemini'}
            </button>
          </form>
          <button className="sample-btn" onClick={() => setQuery(SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)])} disabled={loading} type="button">
            Try a sample query
          </button>
        </div>
      )}

      {mode === 'plan' && (
        <div className="query-form-wrap">
          <form className="query-form" onSubmit={handlePlan}>
            <textarea
              className="query-input query-textarea"
              placeholder={'Paste your schedule, e.g.:\nCMSC 341 MWF 10-10:50am, MATH 251 TuTh 1-2:15pm'}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              disabled={loading}
              rows={3}
            />
            <button className="query-submit" type="submit" disabled={loading || !schedule.trim()}>
              {loading ? <span className="spinner" /> : 'Optimize Gaps'}
            </button>
          </form>
          <button className="sample-btn" onClick={() => setSchedule(SAMPLE_SCHEDULES[Math.floor(Math.random() * SAMPLE_SCHEDULES.length)])} disabled={loading} type="button">
            Load sample schedule
          </button>
        </div>
      )}
    </div>
  )
}
