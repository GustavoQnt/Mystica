'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="mystica-shell flex min-h-screen flex-col items-center justify-center px-6">
      {/* Decorative floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-[15%] top-[20%] h-1 w-1 rounded-full bg-[var(--accent)]"
          style={{ opacity: 0.4, animation: 'pulse-soft 3s ease-in-out infinite' }}
        />
        <div
          className="absolute right-[22%] top-[30%] h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
          style={{ opacity: 0.25, animation: 'pulse-soft 4s ease-in-out infinite 1s' }}
        />
        <div
          className="absolute bottom-[25%] left-[28%] h-1 w-1 rounded-full bg-[var(--accent)]"
          style={{ opacity: 0.3, animation: 'pulse-soft 3.5s ease-in-out infinite 0.5s' }}
        />
        <div
          className="absolute bottom-[35%] right-[18%] h-0.5 w-0.5 rounded-full bg-[var(--accent)]"
          style={{ opacity: 0.35, animation: 'pulse-soft 5s ease-in-out infinite 2s' }}
        />
        <div
          className="absolute left-[40%] top-[12%] h-0.5 w-0.5 rounded-full bg-purple-400"
          style={{ opacity: 0.2, animation: 'pulse-soft 4.5s ease-in-out infinite 1.5s' }}
        />
        <div
          className="absolute right-[35%] bottom-[18%] h-1 w-1 rounded-full bg-purple-300"
          style={{ opacity: 0.15, animation: 'pulse-soft 3.8s ease-in-out infinite 0.8s' }}
        />
      </div>

      {/* Main login card */}
      <div className="mystica-fade-up relative z-10 w-full max-w-md">
        {/* Glow behind the card */}
        <div className="absolute -inset-4 rounded-[3rem] bg-[radial-gradient(circle_at_center,rgba(201,169,110,0.08),transparent_70%)] blur-2xl" />

        <div className="mystica-panel relative rounded-[2.2rem] px-8 py-14 md:px-12 md:py-16">
          {/* Decorative top accent line */}
          <div className="absolute left-1/2 top-0 h-px w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-60" />

          {/* Mystical Symbol */}
          <div className="flex justify-center">
            <div className="relative">
              <svg
                width="72"
                height="72"
                viewBox="0 0 72 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[var(--accent)]"
                style={{ animation: 'pulse-soft 4s ease-in-out infinite' }}
              >
                {/* Outer circle */}
                <circle cx="36" cy="36" r="34" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
                <circle cx="36" cy="36" r="30" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />

                {/* Moon crescent */}
                <path
                  d="M36 10 C48 10 56 20 56 36 C56 52 48 62 36 62 C44 58 48 48 48 36 C48 24 44 14 36 10Z"
                  fill="currentColor"
                  opacity="0.8"
                />

                {/* Star */}
                <path
                  d="M24 36 L27 33 L26 29 L30 31 L34 28 L33 32 L36 36 L33 40 L34 44 L30 41 L26 43 L27 39 Z"
                  fill="currentColor"
                  opacity="0.6"
                />

                {/* Small dots */}
                <circle cx="18" cy="26" r="1" fill="currentColor" opacity="0.5" />
                <circle cx="20" cy="44" r="0.8" fill="currentColor" opacity="0.4" />
                <circle cx="28" cy="54" r="0.6" fill="currentColor" opacity="0.3" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display mt-8 text-center text-5xl tracking-[0.18em] text-[var(--accent)] md:text-6xl">
            Mystica
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-7 text-[var(--muted)]">
            Seu santuário pessoal de tarot, memória e interpretação guiada.
          </p>

          {/* Divider */}
          <div className="mx-auto my-10 flex w-full max-w-[200px] items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--border)]" />
            <svg width="12" height="12" viewBox="0 0 12 12" className="text-[var(--accent)] opacity-50">
              <path d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z" fill="currentColor" />
            </svg>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--border)]" />
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-4 text-sm font-medium text-[#3c4043] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_4px_16px_rgba(201,169,110,0.2)] hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div
                className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-[var(--accent)]"
                style={{ animation: 'spin 0.8s linear infinite' }}
              />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{loading ? 'Conectando...' : 'Entrar com Google'}</span>
          </button>

          {/* Decorative bottom accent line */}
          <div className="absolute bottom-0 left-1/2 h-px w-16 -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-40" />
        </div>
      </div>

      {/* Security note */}
      <div
        className="relative z-10 mt-10 flex items-center gap-2 text-[var(--muted-strong)]"
        style={{ animation: 'fade-up 820ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-xs tracking-wide">
          Seus dados são sagrados. Conexão protegida.
        </p>
      </div>

      {/* Footer brand */}
      <p
        className="relative z-10 mt-6 text-[10px] uppercase tracking-[0.4em] text-[var(--muted-strong)] opacity-50"
        style={{ animation: 'fade-up 820ms cubic-bezier(0.16, 1, 0.3, 1) 400ms both' }}
      >
        Tarot · Memória · Intuição
      </p>

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}
