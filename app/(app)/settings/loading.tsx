export default function SettingsLoading() {
  return (
    <div className="min-h-dvh bg-cream animate-pulse">
      <div className="bg-cream px-5 pt-12 pb-4 flex items-center gap-3 border-b border-navy/6">
        <div className="w-9 h-9 rounded-xl bg-navy/10" />
        <div className="h-6 w-24 bg-navy/10 rounded" />
      </div>
      <div className="px-5 pt-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="mb-5">
            <div className="h-3 w-20 bg-navy/10 rounded mb-2" />
            <div className="bg-white rounded-2xl shadow-card h-32" />
          </div>
        ))}
      </div>
    </div>
  )
}
