interface SkeletonProps {
  className?: string
  rounded?: boolean
}

export function Skeleton({ className = '', rounded = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-white/10 ${rounded ? 'rounded-full' : 'rounded-lg'} ${className}`}
    />
  )
}

export function BarberCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-32 p-3 rounded-2xl bg-surface border border-white/5">
      <Skeleton className="w-20 h-20 mx-auto mb-2" rounded />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-2/3 mx-auto" />
    </div>
  )
}

export function ServiceCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-white/5">
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export function AppointmentCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-white/5">
      <div className="flex gap-3">
        <Skeleton className="w-12 h-12" rounded />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-3 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  )
}
