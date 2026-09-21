import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Onboarding() {
  const { refreshHousehold } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createHousehold() {
    setError('')
    setBusy(true)
    const { error } = await supabase.rpc('create_household', { p_name: 'My Household' })
    setBusy(false)
    if (error) return setError(error.message)
    await refreshHousehold()
  }

  async function joinHousehold(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.rpc('join_household', { p_code: code.trim() })
    setBusy(false)
    if (error) return setError(error.message)
    await refreshHousehold()
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Almost there</h1>
        <p className="muted">
          Create a household to start logging, or join your partner's with the code they share
          with you.
        </p>

        <button onClick={createHousehold} disabled={busy}>
          Create a new household
        </button>

        <div className="divider">or</div>

        <form onSubmit={joinHousehold}>
          <label>
            Invite code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. A3F9K2"
              maxLength={6}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || !code.trim()}>
            Join household
          </button>
        </form>
      </div>
    </div>
  )
}
