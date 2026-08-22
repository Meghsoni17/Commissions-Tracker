import type { AppData } from '../types';
import { recentWeeks, currentMonthKey, monthKey } from './dateUtils';
import { currentFYKey } from './financialYear';

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

  const thisMonth = currentMonthKey();
  const lastMonth = monthKey(weeks[Math.max(0, weeks.length - 5)]);
  const monthlyGoals: AppData['monthlyGoals'] = [
    { monthKey: lastMonth, amount: 8000 },
    { monthKey: thisMonth, amount: 9000 },
  ];

  const fy = currentFYKey();
  const deductions: AppData['deductions'] = [
    {
      id: 'seed-deduction-1',
      financialYear: fy,
      description: 'Car running costs for client visits',
      category: 'Vehicle & Travel',
      amount: 2199.5,
      purchaseDate: weeks[0],
      vendor: 'Shell',
      paymentMethod: 'Debit Card',
      notes: 'Fuel and tolls for client site visits this quarter.',
      createdAt: weeks[0],
    },
    {
      id: 'seed-deduction-2',
      financialYear: fy,
      description: 'Home office setup',
      category: 'Home Office',
      amount: 649.99,
      purchaseDate: weeks[0],
      vendor: 'Officeworks',
      paymentMethod: 'Credit Card',
      notes: 'Desk and monitor arm.',
      createdAt: weeks[0],
    },
    {
      id: 'seed-deduction-3',
      financialYear: fy,
      description: 'CRM course',
      category: 'Professional Development',
      amount: 349.95,
      purchaseDate: weeks[0],
      vendor: 'Udemy',
      paymentMethod: 'PayPal',
      createdAt: weeks[0],
    },
  ];

  const superContributions: AppData['superContributions'] = [
    {
      id: 'seed-super-1',
      date: weeks[Math.max(0, weeks.length - 5)],
      amount: 1200,
      notes: 'AustralianSuper',
    },
    {
      id: 'seed-super-2',
      date: weeks[0],
      amount: 900,
      notes: 'AustralianSuper',
    },
  ];

  return { roles, entries, monthlyGoals, deductions, superContributions };
}
