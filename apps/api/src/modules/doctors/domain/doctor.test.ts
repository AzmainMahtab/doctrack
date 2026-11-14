import { describe, expect, it } from 'vitest';
import { Doctor } from './doctor.ts';

describe('Doctor', () => {
  it('registers with a zero patient count and records doctor.registered', () => {
    const doctor = Doctor.register({
      id: 'd-1',
      name: ' Alice Heart ',
      specialization: 'Cardiology',
      hospital: 'St. Mary Hospital',
      phone: '+14155550123',
      email: ' Alice@Example.COM ',
      now: new Date('2026-11-14T10:00:00Z'),
    });
    expect(doctor.props).toMatchObject({
      name: 'Alice Heart',
      email: 'alice@example.com',
      patientCount: 0,
      isActive: true,
    });
    const events = doctor.pullEvents();
    expect(events.map((e) => e.name)).toEqual(['doctor.registered']);
    expect(events[0]?.payload).toEqual({
      specialization: 'Cardiology',
      hospital: 'St. Mary Hospital',
      registeredOn: '2026-11-14',
    });
  });
});
