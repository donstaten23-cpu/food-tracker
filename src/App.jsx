import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import History from './pages/History'
import Settings from './pages/Settings'
import NavBar from './components/NavBar'

function Gate() {
  const { session, household } = useAuth()

  if (session === undefined) return <div className="loading-screen">Loading…</div>
  if (!session) return <Login />
  if (household === undefined) return <div className="loading-screen">Loading…</div>
  if (!household) return <Onboarding />

  return (
    <BrowserRouter>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
