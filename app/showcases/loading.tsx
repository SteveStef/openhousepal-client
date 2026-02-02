export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] dark:from-[#0B0B0B] dark:via-[#0B0B0B] dark:to-[#0B0B0B] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] dark:border-white mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading Showcases...</p>
      </div>
    </div>
  )
}
