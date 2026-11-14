'use client';

import { RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
      <Alert>We couldn&apos;t load this page. Check your connection and try again.</Alert>
      <div>
        <Button variant="secondary" icon={RefreshCw} onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
