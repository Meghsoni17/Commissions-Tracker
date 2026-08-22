import type { AppData } from '../types';
import { recentWeeks } from './dateUtils';

/** Sample data shown on first run so the dashboard isn't empty. Clearly marked so it can be wiped. */
export function buildSeedData(): AppData {
  const weeks = recentWeeks(10);
  const roles: AppData['roles'] = [
    { id: 'role-sales', name: 'Closer', colorSlot: 1, archived: false, createdAt: weeks[0] },
    { id: 'role-setter', name: 'Setter', colorSlot: 2, archived: false, createdAt: weeks[0] },
  ];

  const entries: AppData['entries'] = [];
  let n = 0;
  for (const week of weeks) {
    n += 1;
    const booked1 = 14 + (n % 4);
    const showed1 = Math.round(booked1 * (0.55 + (n % 3) * 0.05));
    const closed1 = Math.round(showed1 * (0.28 + (n % 4) * 0.03));
    entries.push({
      id: `seed-sales-${week}`,
      roleId: 'role-sales',
      weekStart: week,
      booked: booked1,
      showed: showed1,
      closed: closed1,
      commission: closed1 * (900 + (n % 5) * 60),
    });

    const booked2 = 9 + (n % 3);
    const showed2 = Math.round(booked2 * (0.6 + (n % 3) * 0.04));
    const closed2 = Math.round(showed2 * (0.2 + (n % 3) * 0.03));
    entries.push({
      id: `seed-setter-${week}`,
      roleId: 'role-setter',
      weekStart: week,
      booked: booked2,
      showed: showed2,
      closed: closed2,
      commission: closed2 * (250 + (n % 4) * 40),
    });
  }

  return { roles, entries };
}
