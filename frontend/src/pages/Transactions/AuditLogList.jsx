import { useCallback } from 'react';
import { Link } from 'react-router';
import { listAuditLog } from '@/api/transactions.js';
import { formatDateTime, formatMoney } from '@/utils/format.js';
import { ActionBadge, AuditChanges, DeletedBadge } from './auditDisplay.jsx';
import PagedList from './PagedList.jsx';
import { toApiParams } from './transactionFilters.js';

/** One page of every action on the space's transactions, newest first, deleted ones included. */
export default function AuditLogList({ filters, search, filtered, onPage }) {
  const load = useCallback((signal) => listAuditLog(toApiParams(filters), signal), [filters]);
  return (
    <PagedList
      load={load} filters={filters} onPage={onPage} label="Audit log"
      empty={filtered ? 'No actions match these filters' : 'No actions yet'}
      renderItem={(entry) => <AuditRow key={entry.id} entry={entry} search={search} />}
    />
  );
}

function AuditRow({ entry, search }) {
  const { expense } = entry;
  return (
    <li>
      <Link
        to={{ pathname: `/transactions/${expense.id}`, search }}
        className="flex flex-col gap-2 rounded-md border p-3 transition-colors hover:bg-muted/60"
      >
        <span className="flex flex-wrap items-center gap-2">
          <ActionBadge action={entry.action} />
          <span className="font-semibold text-foreground">
            {formatMoney(expense.amount, expense.currency)} · {expense.category.name}
          </span>
          {expense.deleted_at && <DeletedBadge />}
        </span>
        <span className="text-sm">
          By {entry.performed_by.display_name} on {formatDateTime(entry.created_at)}
        </span>
        <AuditChanges changes={entry.changes} />
      </Link>
    </li>
  );
}
