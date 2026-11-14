import { ChevronDown } from 'lucide-react';
import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function NativeSelect({
  label,
  error,
  options,
  className,
  ref,
  ...rest
}: {
  label: string;
  error?: string | undefined;
  options: readonly { value: string; label: string }[];
  ref?: React.Ref<HTMLSelectElement>;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
  const id = useId();
  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-note` : undefined}
          {...rest}
          className={cn(
            'h-10 w-full appearance-none rounded-ui border bg-bg px-3 pr-9 text-body text-ink focus-visible:border-accent max-md:h-11',
            error ? 'border-critical' : 'border-border-input',
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
      </div>
      {error ? (
        <p id={`${id}-note`} className="text-caption text-critical-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
