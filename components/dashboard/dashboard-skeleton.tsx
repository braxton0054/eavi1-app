import { Skeleton } from "@/components/ui/skeleton";

/** Static shell shown while the session read resolves. */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-dvh" role="status" aria-label="Loading portal">
      <div className="hidden w-64 shrink-0 flex-col gap-4 border-e border-eavi-border p-4 lg:flex">
        <Skeleton className="h-11 w-full rounded-xl" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex-1 space-y-6 p-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
