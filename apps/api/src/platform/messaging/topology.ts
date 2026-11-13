export interface Topology {
  eventsStream: string;
  dlqStream: string;
  eventPrefix: string;
  dlqPrefix: string;
}

export const defaultTopology: Topology = {
  eventsStream: 'DOMAIN_EVENTS',
  dlqStream: 'DEAD_LETTERS',
  eventPrefix: 'evt',
  dlqPrefix: 'dlq',
};

export const eventSubject = (topology: Topology, name: string): string =>
  `${topology.eventPrefix}.${name}`;

export const dlqSubject = (topology: Topology, consumer: string): string =>
  `${topology.dlqPrefix}.${consumer}`;
