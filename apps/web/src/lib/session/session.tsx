'use client';

import type { Me } from '@doctrack/contracts';
import { createContext, useContext, type ReactNode } from 'react';

const SessionContext = createContext<Me | null>(null);

export function SessionProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <SessionContext.Provider value={me}>{children}</SessionContext.Provider>;
}

export function useSession(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error('useSession must be used inside SessionProvider');
  return me;
}

export function useCan(permission: string): boolean {
  return useSession().permissions.includes(permission);
}
