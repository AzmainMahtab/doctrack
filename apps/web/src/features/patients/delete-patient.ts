'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { deleter } from '@/lib/deferred-delete';
import { keys } from '@/lib/query/keys';

interface ListData {
  data: { id: string }[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const isList = (value: unknown): value is ListData =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as ListData).data) &&
  'meta' in value;

export function removeFromLists(client: QueryClient, id: string): void {
  client.setQueriesData({ queryKey: keys.patients.all }, (old: unknown) => {
    if (!isList(old) || !old.data.some((row) => row.id === id)) return old;
    const total = Math.max(0, old.meta.total - 1);
    return {
      ...old,
      data: old.data.filter((row) => row.id !== id),
      meta: { ...old.meta, total, totalPages: Math.ceil(total / old.meta.limit) },
    };
  });
}

export function useDeletePatient() {
  const client = useQueryClient();
  const toast = useToast();
  return useCallback(
    (id: string) => {
      const invalidateAll = () =>
        Promise.all([
          client.invalidateQueries({ queryKey: keys.patients.all }),
          client.invalidateQueries({ queryKey: keys.doctors.all }),
          client.invalidateQueries({ queryKey: keys.dashboard.all }),
        ]);
      deleter.schedule(id, {
        optimistic: () => removeFromLists(client, id),
        restore: () => void client.invalidateQueries({ queryKey: keys.patients.all }),
        commit: ({ keepalive }) => api<void>(`/patients/${id}`, { method: 'DELETE', keepalive }),
        onCommitted: () => void invalidateAll(),
        onFailed: () =>
          toast.show({ message: "Couldn't delete. The patient was restored.", duration: 6000 }),
      });
      toast.show({
        message: 'Patient deleted.',
        action: { label: 'Undo', onAction: () => void deleter.undo(id) },
        duration: 5000,
      });
    },
    [client, toast],
  );
}
