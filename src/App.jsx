import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Foods from './pages/Foods'
import History from './pages/History'
import Settings from './pages/Settings'
import NavBar from './components/NavBar'

function Gate() {
  const { session, household } = useAuth()

  if (session === undefined) return <div className="loading-screen">Loading…</div>
  if (!session) return <Login />
  if (household === undefined) return <div className="loading-screen">Loading…</div>
  if (!household) return <Onboarding />

  // HashRouter (URLs like /#/history) because GitHub Pages has no server-side
  // fallback: refreshing on a BrowserRouter path like /history would 404.
  return (
    <HashRouter>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/foods" element={<Foods />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </HashRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
