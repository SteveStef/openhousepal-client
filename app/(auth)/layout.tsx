export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900">
      {children}
    </div>
  )
}