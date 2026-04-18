import { useState, useEffect } from 'react'

export default function Header() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const formatted = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const day = time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-text">SeatSniper</div>
        <p className="tagline">UMBC · Live study spots</p>
      </div>
      <div className="clock">
        <span className="clock-time">{formatted}</span>
        <span className="clock-day">{day}</span>
      </div>
    </header>
  )
}
