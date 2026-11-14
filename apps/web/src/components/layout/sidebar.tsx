import { Account } from './account';
import { NavLinks } from './nav-links';

export function Sidebar({ email, role }: { email: string; role: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col bg-bg-sunken px-4 py-6 lg:flex">
      <div className="flex flex-col gap-0.5 px-3 pt-1 pb-7">
        <span className="font-display text-[1.5rem] leading-none font-medium tracking-[-0.01em] text-ink">
          Doctrack
        </span>
        <span className="text-caption text-ink-subtle">Clinic register</span>
      </div>
      <NavLinks />
      <div className="flex-1" />
      <Account email={email} role={role} />
    </aside>
  );
}
