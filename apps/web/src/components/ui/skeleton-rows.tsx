export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-13 items-center gap-4 border-b border-border">
          <span className="h-3 flex-1 rounded-mark bg-bg-sunken" />
          <span className="h-3 w-1/5 rounded-mark bg-bg-sunken max-md:hidden" />
          <span className="h-3 w-1/6 rounded-mark bg-bg-sunken max-lg:hidden" />
          <span className="h-3 w-12 rounded-mark bg-bg-sunken" />
        </div>
      ))}
    </div>
  );
}
