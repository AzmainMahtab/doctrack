import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center justify-center p-6">
      <EmptyState
        as="h1"
        title="This page is not on the register"
        body="The address may be wrong, or the record may have been removed."
        action={<LinkButton href="/dashboard">Go to the dashboard</LinkButton>}
      />
    </main>
  );
}
