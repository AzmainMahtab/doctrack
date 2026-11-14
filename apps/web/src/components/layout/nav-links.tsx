'use client';

import { LayoutDashboard, Stethoscope, Users } from 'lucide-react';
import { NavItem } from './nav-item';

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      <NavItem
        href="/dashboard"
        label="Dashboard"
        icon={LayoutDashboard}
        {...(onNavigate ? { onNavigate } : {})}
      />
      <NavItem
        href="/doctors"
        label="Doctors"
        icon={Stethoscope}
        {...(onNavigate ? { onNavigate } : {})}
      />
      <NavItem
        href="/patients"
        label="Patients"
        icon={Users}
        {...(onNavigate ? { onNavigate } : {})}
      />
    </nav>
  );
}
