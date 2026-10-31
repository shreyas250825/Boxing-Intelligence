export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-2/3" />
    </div>
  )
}