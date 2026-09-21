import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly at startup instead of a confusing blank screen — see
  // .env.example for what to set.
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  )
}

export const supabase = createClient(url, anonKey)

// Calls the estimate-food Edge Function with the current user's auth token.
export async function estimateFood(description) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not signed in')

  const resp = await fetch(`${url}/functions/v1/estimate-food`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ description }),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Estimate request failed')
  return data.estimate
}
