import { RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { LinkButton } from '@/components/ui/button';

export function SectionError({ what, href }: { what: string; href: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert className="w-full">
        We couldn&apos;t load {what}. Check your connection and try again.
      </Alert>
      <LinkButton href={href} variant="secondary" icon={RefreshCw}>
        Try again
      </LinkButton>
    </div>
  );
}
