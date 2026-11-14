import type { Condition } from '@doctrack/contracts';
import { cn } from '@/lib/cn';

export const CONDITION_LABEL: Record<Condition, string> = {
  stable: 'Stable',
  under_observation: 'Under observation',
  critical: 'Critical',
  recovered: 'Recovered',
};

export const CONDITION_COLOR: Record<Condition, string> = {
  stable: 'bg-stable',
  under_observation: 'bg-observation',
  critical: 'bg-critical',
  recovered: 'bg-recovered',
};

const TONE: Record<Condition, string> = {
  stable: 'bg-stable-wash text-stable-ink',
  under_observation: 'bg-observation-wash text-observation-ink',
  critical: 'bg-critical-wash text-critical-ink',
  recovered: 'bg-recovered-wash text-recovered-ink',
};

export function ConditionTag({ condition }: { condition: Condition }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-caption font-semibold whitespace-nowrap',
        TONE[condition],
      )}
    >
      <span className={cn('size-2 rounded-full', CONDITION_COLOR[condition])} aria-hidden />
      {CONDITION_LABEL[condition]}
    </span>
  );
}
