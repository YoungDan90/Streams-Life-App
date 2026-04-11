export default function PlannerLoading() {
  return (
    <div className="px-5 pt-12 pb-8 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-navy/10 rounded" />
        <div className="w-9 h-9 rounded-xl bg-navy/10" />
      </div>
      <div className="h-10 bg-navy/5 rounded-xl mb-6" />
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-card shadow-card p-4 mb-4 h-24" />
      ))}
    </div>
  )
}
