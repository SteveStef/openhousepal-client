export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // The pages' own cream (dark: near-black) - the old black gradient showed as a black bar under the
    // sign-in page on an iPhone (the page is 100dvh tall, this wrapper 100vh; owner, 11/01).
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      {children}
    </div>
  )
}