export const keys = {
  session: ['session'] as const,
  doctors: {
    all: ['doctors'] as const,
    list: (query: object) => ['doctors', 'list', query] as const,
    detail: (id: string) => ['doctors', 'detail', id] as const,
    facets: ['doctors', 'facets'] as const,
    lookup: (q: string) => ['doctors', 'lookup', q] as const,
  },
  patients: {
    all: ['patients'] as const,
    list: (query: object) => ['patients', 'list', query] as const,
    ofDoctor: (doctorId: string, query: object) => ['patients', 'doctor', doctorId, query] as const,
    detail: (id: string) => ['patients', 'detail', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: ['dashboard', 'summary'] as const,
    conditions: ['dashboard', 'conditions'] as const,
    perDoctor: (limit: number) => ['dashboard', 'per-doctor', limit] as const,
    timeseries: (query: object) => ['dashboard', 'timeseries', query] as const,
  },
};
