import type { AppData } from '../types';
import { recentWeeks, currentMonthKey, monthKey, todayISO } from './dateUtils';
import { currentFYKey } from './financialYear';
import { generateInstallments } from './deals';
import { addDays, format, parseISO } from 'date-fns';

/** Sample data shown on first run so the dashboard isn't empty. Clearly marked so it can be wiped. */
export function buildSeedData(): AppData {
  const weeks = recentWeeks(10);
  const roles: AppData['roles'] = [
    { id: 'role-sales', name: 'Closer', colorSlot: 1, archived: false, createdAt: weeks[0], commissionRate: 10 },
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

  const deals: AppData['deals'] = [
    {
      id: 'seed-deal-1',
      roleId: 'role-sales',
      clientName: 'Northwind Retail',
      saleDate: weeks[weeks.length - 3],
      totalContractValue: 12000,
      cashCollectedOnCall: 4000,
      paymentStructure: 'Installments',
      installments: generateInstallments(
        format(addDays(parseISO(weeks[weeks.length - 3]), 30), 'yyyy-MM-dd'),
        4,
        'Monthly',
        8000,
      ).map((installment, idx) => (idx === 0 ? { ...installment, paid: true, paidDate: weeks[weeks.length - 1] } : installment)),
      notes: 'Deposit taken on the close, balance over 4 months.',
      createdAt: weeks[weeks.length - 3],
      commissionRate: 10,
    },
    {
      id: 'seed-deal-2',
      roleId: 'role-sales',
      clientName: 'Harbor & Co',
      saleDate: weeks[weeks.length - 1],
      totalContractValue: 3500,
      cashCollectedOnCall: 3500,
      paymentStructure: 'Paid in Full',
      installments: [],
      createdAt: weeks[weeks.length - 1],
      commissionRate: 10,
    },
    {
      id: 'seed-deal-3',
      roleId: 'role-sales',
      clientName: 'Beacon Fitness',
      saleDate: weeks[0],
      totalContractValue: 6000,
      cashCollectedOnCall: 1000,
      paymentStructure: 'Custom Schedule',
      installments: [
        { id: 'seed-installment-1', dueDate: todayISO(), amount: 2500, paid: false },
        { id: 'seed-installment-2', dueDate: format(addDays(new Date(), 21), 'yyyy-MM-dd'), amount: 2500, paid: false },
      ],
      notes: 'Custom split negotiated around their cash flow.',
      createdAt: weeks[0],
      commissionRate: 10,
    },
  ];

  return { roles, entries, monthlyGoals, deductions, superContributions, deals };
}
