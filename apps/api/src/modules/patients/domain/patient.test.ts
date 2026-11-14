import { describe, expect, it } from 'vitest';
import { Patient, type PatientProps } from './patient.ts';

const now = new Date('2026-11-14T10:00:00Z');
const later = new Date('2026-11-14T11:00:00Z');

const admit = () =>
  Patient.admit({
    id: 'p-1',
    doctorId: 'd-1',
    doctorName: 'Alice Heart',
    name: '  John Carter ',
    dateOfBirth: new Date('1985-03-21T00:00:00Z'),
    gender: 'male',
    phone: '+14155550199',
    email: 'John@Example.com ',
    condition: 'critical',
    diagnosis: ' Hypertension ',
    admittedAt: new Date('2026-11-01T09:30:00Z'),
    now,
  });

describe('Patient', () => {
  it('normalizes input and records patient.registered', () => {
    const patient = admit();
    expect(patient.props).toMatchObject({
      name: 'John Carter',
      email: 'john@example.com',
      diagnosis: 'Hypertension',
      createdAt: now,
      updatedAt: now,
    });
    const events = patient.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe('patient.registered');
    expect(events[0]?.payload).toEqual({
      doctorId: 'd-1',
      condition: 'critical',
      admittedAt: '2026-11-01T09:30:00.000Z',
    });
  });

  it('records patient.updated listing only the fields that changed', () => {
    const patient = admit();
    patient.pullEvents();
    const changed = patient.update({ name: 'John Carter', phone: '+14155550000' }, later);
    expect(changed).toEqual(['phone']);
    expect(patient.props.updatedAt).toBe(later);
    const events = patient.pullEvents();
    expect(events.map((e) => e.name)).toEqual(['patient.updated']);
    expect(events[0]?.payload).toEqual({ doctorId: 'd-1', changed: ['phone'] });
  });

  it('records condition_changed with the old and new condition', () => {
    const patient = admit();
    patient.pullEvents();
    patient.update({ condition: 'stable' }, later);
    const events = patient.pullEvents();
    expect(events.map((e) => e.name)).toEqual(['patient.updated', 'patient.condition_changed']);
    expect(events[1]?.payload).toEqual({ doctorId: 'd-1', from: 'critical', to: 'stable' });
  });

  it('treats equal dates as unchanged and records nothing', () => {
    const patient = admit();
    patient.pullEvents();
    const before: PatientProps = patient.props;
    const changed = patient.update(
      {
        admittedAt: new Date('2026-11-01T09:30:00Z'),
        dateOfBirth: new Date('1985-03-21T00:00:00Z'),
      },
      later,
    );
    expect(changed).toEqual([]);
    expect(patient.pullEvents()).toEqual([]);
    expect(patient.props).toBe(before);
  });

  it('records patient.removed with the condition at removal time', () => {
    const patient = admit();
    patient.pullEvents();
    patient.update({ condition: 'recovered' }, later);
    patient.pullEvents();
    patient.remove();
    const events = patient.pullEvents();
    expect(events.map((e) => e.name)).toEqual(['patient.removed']);
    expect(events[0]?.payload).toEqual({ doctorId: 'd-1', condition: 'recovered' });
  });

  it('never puts personal data in event payloads', () => {
    const patient = admit();
    patient.update({ email: 'other@example.com', name: 'Someone Else' }, later);
    patient.remove();
    const text = JSON.stringify(patient.pullEvents().map((e) => e.payload));
    expect(text).not.toMatch(/John|Carter|example\.com|\+1415/);
  });
});
