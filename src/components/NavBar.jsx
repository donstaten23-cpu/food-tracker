import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="nav-bar">
      <div className="nav-brand">Food Tracker</div>
      <nav>
        <NavLink to="/" end>
          Today
        </NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <div className="nav-right">
        <span className="muted small">{user?.email}</span>
        <button className="link-button" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
