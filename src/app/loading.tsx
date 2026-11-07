function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-700/50 ${className}`} />;
}

export default function Loading() {
  return (
    <main aria-label="Memuat PanciLedger" aria-busy="true" className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-white/[.06] p-6 lg:block">
          <div className="mb-10 flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        </aside>
        <section className="min-w-0 flex-1 p-5 sm:p-8">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-44 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="size-10 rounded-full" />
          </header>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="panel space-y-4 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-36 max-w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="panel space-y-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-9 w-28" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-white/[.06] pt-4">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40 max-w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <p className="muted mt-6 text-center text-xs">Menyiapkan data PanciLedger…</p>
        </section>
      </div>
    </main>
  );
}
