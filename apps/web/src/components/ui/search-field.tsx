'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  name = 'q',
  delay = 300,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  name?: string;
  delay?: number;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const last = useRef(value);

  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === last.current) return;
    const timer = setTimeout(() => {
      last.current = text;
      onChange(text);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay, onChange]);

  return (
    <div
      role="search"
      className={cn(
        'flex h-10 w-full items-center gap-2 rounded-ui border border-border-input bg-bg px-3 focus-within:border-accent max-md:h-11',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      <input
        type="search"
        name={name}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-subtle focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}
