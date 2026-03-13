'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/', label: 'Santuario' },
  { href: '/reading', label: 'Nova tiragem' },
  { href: '/history', label: 'Historico' },
]

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
      <Link href="/" className="font-display text-3xl tracking-[0.28em] text-[var(--accent)]">
        Mystica
      </Link>

      <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-white/3 p-1.5 md:flex">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm ${
                active
                  ? 'bg-[var(--accent-soft)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
      >
        Sair
      </button>
    </header>
  )
}
