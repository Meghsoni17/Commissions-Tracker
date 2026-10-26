import type { Deal, Role } from '../types';
import { upcomingReminders } from '../lib/deals';
import { formatCurrencyExact } from '../lib/calculations';
import { formatShortDate } from '../lib/dateUtils';
import { RoleBadge } from './RoleBadge';

export function UpcomingPayments({
  deals,
  roles,
  withinDays,
  limit,
  emptyMessage = 'No upcoming follow-up payments.',
}: {
  deals: Deal[];
  roles: Role[];
  withinDays?: number;
  limit?: number;
  emptyMessage?: string;
}) {
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const reminders = upcomingReminders(deals, withinDays);
  const shown = limit ? reminders.slice(0, limit) : reminders;

  if (shown.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {shown.map(({ deal, installment, daysUntilDue, overdue }) => {
        const role = roleById.get(deal.roleId);
        return (
          <li
            key={installment.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm flex-wrap"
            style={{
              borderColor: overdue ? 'var(--critical)' : 'var(--border)',
              background: 'var(--surface-2)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{deal.clientName}</span>
              {role && <RoleBadge name={role.name} colorSlot={role.colorSlot} />}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="tabular-nums font-medium">{formatCurrencyExact(installment.amount)}</span>
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: overdue ? 'var(--critical)' : 'var(--text-secondary)' }}
              >
                {overdue
                  ? `Overdue since ${formatShortDate(installment.dueDate)}`
                  : daysUntilDue === 0
                    ? `Due today (${formatShortDate(installment.dueDate)})`
                    : `Due in ${daysUntilDue}d (${formatShortDate(installment.dueDate)})`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
