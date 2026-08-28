import { describe, it, expect } from 'vitest';
import { planReminders, ANNUAL_REMINDER_CHECKPOINTS, MONTHLY_REMINDER_CHECKPOINTS } from './next-charge-date';

const emptyState = { reminderCycleDue: null, reminderCheckpointsSent: [] as number[] };

describe('checkpoints anuales (30/15/1 días antes)', () => {
  it('a 30 días exactos, toca avisar el checkpoint de 30', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 6, 28); // 30 días antes
    const plan = planReminders(due, 'annual', emptyState, today);
    expect(plan.checkpointsToSend).toEqual([30]);
  });

  it('a 15 días, si el 30 ya se avisó, solo manda el de 15', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 7, 12); // 15 días antes
    const state = { reminderCycleDue: '2027-08-27', reminderCheckpointsSent: [30] };
    const plan = planReminders(due, 'annual', state, today);
    expect(plan.checkpointsToSend).toEqual([15]);
  });

  it('no repite un checkpoint ya avisado en el mismo ciclo', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 6, 28);
    const state = { reminderCycleDue: '2027-08-27', reminderCheckpointsSent: [30] };
    const plan = planReminders(due, 'annual', state, today);
    expect(plan.checkpointsToSend).toEqual([]);
  });

  it('el día de vencimiento (0 días) ya no manda avisos "antes"', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 7, 27);
    const plan = planReminders(due, 'annual', emptyState, today);
    expect(plan.checkpointsToSend).toEqual([]);
  });
});

describe('checkpoints mensuales (2/1 días antes)', () => {
  it('a 2 días, manda el checkpoint de 2', () => {
    const due = new Date(2026, 8, 27);
    const today = new Date(2026, 8, 25);
    expect(planReminders(due, 'monthly', emptyState, today).checkpointsToSend).toEqual([2]);
  });

  it('a 1 día, manda el checkpoint de 1', () => {
    const due = new Date(2026, 8, 27);
    const today = new Date(2026, 8, 26);
    expect(planReminders(due, 'monthly', emptyState, today).checkpointsToSend).toEqual([1]);
  });
});

describe('reinicio de ciclo', () => {
  it('si el próximo cobro avanzó, el ciclo es nuevo y olvida lo ya avisado', () => {
    const due = new Date(2026, 9, 27); // el recurrente ya avanzó a octubre
    const today = new Date(2026, 9, 26);
    const state = { reminderCycleDue: '2026-09-27', reminderCheckpointsSent: [2, 1] }; // ciclo viejo (septiembre)
    const plan = planReminders(due, 'monthly', state, today);
    expect(plan.isNewCycle).toBe(true);
    expect(plan.checkpointsToSend).toEqual([1]);
    expect(plan.cycleDue).toBe('2026-10-27');
  });
});
