'use client'

export default function RecalculatingIndicator() {
  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      <span>Actualizando territorios...</span>
    </div>
  )
}