export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-navy flex flex-col">
      {children}
    </div>
  )
}
