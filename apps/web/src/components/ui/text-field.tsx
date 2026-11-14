import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  ref,
  ...rest
}: TextFieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-subtle">optional</span> : null}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        {...rest}
        className={cn(
          'h-10 w-full rounded-ui border bg-bg px-3 text-body text-ink placeholder:text-ink-subtle focus-visible:border-accent max-md:h-11',
          error ? 'border-critical' : 'border-border-input',
        )}
      />
      {note ? (
        <p
          id={`${id}-note`}
          className={cn('text-caption', error ? 'text-critical-ink' : 'text-ink-subtle')}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
