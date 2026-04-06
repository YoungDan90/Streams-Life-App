'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CheckSquare, MessageCircle, Calendar, Zap } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/checkin', icon: CheckSquare, label: 'Check-In' },
  { href: '/coach', icon: MessageCircle, label: 'Coach' },
  { href: '/planner', icon: Calendar, label: 'Planner' },
  { href: '/lockin', icon: Zap, label: 'Lock In' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-navy border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[60px] ${
                active ? 'text-gold' : 'text-white/35 hover:text-white/60'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-gold' : ''}
              />
              <span className={`text-[10px] font-medium ${active ? 'text-gold' : ''}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
