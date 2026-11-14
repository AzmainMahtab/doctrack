import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function TextAreaField({
  label,
  error,
  hint,
  optional,
  ref,
  ...rest
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-subtle">optional</span> : null}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        {...rest}
        className={cn(
          'w-full resize-y rounded-ui border bg-bg px-3 py-2 text-body text-ink placeholder:text-ink-subtle focus-visible:border-accent',
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
