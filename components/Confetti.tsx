'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiProps {
  trigger: boolean
}

export default function Confetti({ trigger }: ConfettiProps) {
  useEffect(() => {
    if (!trigger) return

    const end = Date.now() + 2000
    const colors = ['#C9A84C', '#0D1B2A', '#D4B86A', '#F8F7F4']

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }

    frame()
  }, [trigger])

  return null
}
