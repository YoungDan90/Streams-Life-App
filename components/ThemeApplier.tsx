'use client'

import { useEffect } from 'react'

interface ThemeApplierProps {
  appearanceMode: 'light' | 'dark'
}

/**
 * Applies the user's appearance_mode preference as a class on <html>.
 * Tailwind's darkMode: "class" requires the "dark" class on the html element.
 */
export default function ThemeApplier({ appearanceMode }: ThemeApplierProps) {
  useEffect(() => {
    const root = document.documentElement
    if (appearanceMode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [appearanceMode])

  return null
}
