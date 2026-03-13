'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0d0d1a, #1a0a2e)' }}>
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-serif" style={{ color: '#c9a96e' }}>
          Mystica
        </h1>
        <p className="text-sm" style={{ color: '#c9a96e88' }}>
          Sua tarologa digital
        </p>
        <button
          onClick={signInWithGoogle}
          className="px-8 py-3 rounded-lg text-white font-medium"
          style={{ background: 'linear-gradient(90deg, #4a2080, #7b3fa0)' }}
        >
          Entrar com Google
        </button>
      </div>
    </main>
  )
}
