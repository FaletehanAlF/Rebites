export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-[1400px] px-5 pt-24 sm:px-8 lg:px-12">
        <div className="h-10 w-2/3 max-w-md animate-pulse rounded-full bg-muted/50" />
        <div className="mt-4 h-10 w-1/2 max-w-sm animate-pulse rounded-full bg-muted/50" />
        <div className="mt-6 h-4 w-full max-w-lg animate-pulse rounded-full bg-muted" />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-[var(--radius)] bg-white shadow-sm"
              style={{ animationDelay: `${i * 91}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
