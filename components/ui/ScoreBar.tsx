interface ScoreBarProps {
  label: string
  score: number // 1-5
  max?: number
}

export default function ScoreBar({ label, score, max = 5 }: ScoreBarProps) {
  const pct = (score / max) * 100
  const color =
    score <= 2
      ? 'bg-red-400'
      : score === 3
      ? 'bg-amber-400'
      : 'bg-gold'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-navy/60 w-28 truncate">{label}</span>
      <div className="flex-1 h-2 bg-navy/8 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-navy w-5 text-right">{score}</span>
    </div>
  )
}
