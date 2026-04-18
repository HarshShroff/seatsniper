export default function Header({ now }) {
  const formatted = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const day = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon">S</div>
        <span className="logo-text">SeatSniper</span>
      </div>

      <div className="header-right">
        <div className="clock-pill">
          <span className="clock-time">{formatted}</span>
          <span className="clock-day">{day}</span>
        </div>
      </div>
    </header>
  )
}
