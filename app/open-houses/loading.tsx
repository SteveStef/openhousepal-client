export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading Open Houses...</p>
      </div>
    </div>
  )
}
