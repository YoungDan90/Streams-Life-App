export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-navy flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-gold rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold">
            <span className="font-heading text-3xl font-bold text-navy">S</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Streams Life</h1>
          <p className="text-gold/80 text-sm mt-1">Build the business. Live the life.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
