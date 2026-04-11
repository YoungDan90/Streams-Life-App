export default function HomeLoading() {
  return (
    <div className="px-5 pt-12 pb-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-3 w-32 bg-navy/10 rounded mb-2" />
          <div className="h-7 w-48 bg-navy/10 rounded" />
        </div>
        <div className="w-9 h-9 rounded-xl bg-navy/10" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-card shadow-card p-4 h-16" />
        <div className="bg-white rounded-card shadow-card p-4 h-16" />
      </div>

      {/* Life balance card skeleton */}
      <div className="bg-white rounded-card shadow-card p-4 mb-5 h-36" />

      {/* Insight card skeleton */}
      <div className="bg-navy/80 rounded-card p-5 mb-5 h-24" />

      {/* Bottom shortcuts skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gold/30 rounded-card p-4 h-16" />
        <div className="bg-navy/10 rounded-card p-4 h-16" />
        <div className="col-span-2 bg-white rounded-card shadow-card p-4 h-16" />
      </div>
    </div>
  )
}
