import { CONDITIONS, type ConditionCounts } from '@doctrack/contracts';
import { CONDITION_COLOR, CONDITION_LABEL } from '@/components/ui/condition-tag';
import { share } from '@/lib/format';

export function ConditionPanel({ conditions }: { conditions: ConditionCounts }) {
  return (
    <section
      aria-labelledby="conditions-title"
      className="flex w-full flex-col gap-4 lg:w-100 lg:shrink-0"
    >
      <h2 id="conditions-title" className="font-display text-h2 font-medium text-ink">
        Patients by condition
      </h2>
      <div aria-hidden className="flex h-3 gap-0.5">
        {CONDITIONS.map((condition) => (
          <span
            key={condition}
            className={`${CONDITION_COLOR[condition]} rounded-mark`}
            style={{
              flexGrow: conditions.counts[condition],
              flexBasis: 0,
              minWidth: conditions.counts[condition] > 0 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col">
        {CONDITIONS.map((condition) => (
          <li key={condition} className="flex h-10 items-center gap-3 border-b border-border">
            <span aria-hidden className={`${CONDITION_COLOR[condition]} size-2 rounded-full`} />
            <span className="flex-1 text-body text-ink">{CONDITION_LABEL[condition]}</span>
            <span className="w-10 text-right text-body font-medium text-ink tabular-nums">
              {conditions.counts[condition]}
            </span>
            <span className="w-12 text-right text-small text-ink-muted tabular-nums">
              {share(conditions.counts[condition], conditions.total)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-subtle">
        Counts come from the dashboard summary and are cached for 30 seconds.
      </p>
    </section>
  );
}
