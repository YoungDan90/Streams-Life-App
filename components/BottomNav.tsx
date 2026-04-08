'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CheckSquare, MessageCircle, LayoutGrid, Zap, CalendarDays } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/home',     icon: Home,          label: 'Home'     },
  { href: '/checkin',  icon: CheckSquare,   label: 'Check-In' },
  { href: '/calendar', icon: CalendarDays,  label: 'Calendar' },
  { href: '/coach',    icon: MessageCircle, label: 'Coach'    },
  { href: '/planner',  icon: LayoutGrid,    label: 'Planner'  },
  { href: '/lockin',   icon: Zap,           label: 'Lock In'  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 inset-x-0 z-50 bg-navy border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around px-1 pt-2 pb-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl transition-all min-w-[44px] min-h-[44px] justify-center ${
                active ? 'text-gold' : 'text-white/50 hover:text-white/70'
              }`}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                aria-hidden="true"
              />
              <span className={`text-[9px] font-medium leading-tight ${active ? 'text-gold' : ''}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
