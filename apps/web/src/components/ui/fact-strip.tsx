export function FactStrip({ facts }: { facts: readonly { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border py-4 md:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-caption font-semibold tracking-[0.05em] text-ink-muted uppercase">
            {fact.label}
          </dt>
          <dd className="m-0 text-body break-words text-ink">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
