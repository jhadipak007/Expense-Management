import { useCallback } from 'react';
import { Link } from 'react-router';
import { listTransactions } from '@/api/transactions.js';
import { formatDateTime, formatIsoDate, formatMoney } from '@/utils/format.js';
import PagedList from './PagedList.jsx';
import { toApiParams } from './transactionFilters.js';

/**
 * One page of the space's transactions, latest expense date first. Each row
 * opens the transaction; `search` keeps the page's filters for the way back.
 */
export default function TransactionList({ filters, search, filtered, onPage }) {
  const load = useCallback((signal) => listTransactions(toApiParams(filters), signal), [filters]);
  return (
    <PagedList
      load={load} filters={filters} onPage={onPage} label="Transactions"
      empty={filtered ? 'No transactions match these filters' : 'No transactions yet'}
      renderItem={(item) => <TransactionRow key={item.id} item={item} search={search} />}
    />
  );
}

function TransactionRow({ item, search }) {
  return (
    <li>
      <Link
        to={{ pathname: `/transactions/${item.id}`, search }}
        className="flex flex-col gap-2 rounded-md border p-3 transition-colors hover:bg-muted/60 md:flex-row md:items-start md:justify-between"
      >
        <span className="flex min-w-0 flex-col gap-1 wrap-anywhere">
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.category.color }} aria-hidden="true" />
            {item.category.name}
            <span className="font-normal">· {formatIsoDate(item.spent_on)}</span>
          </span>
          {item.description && <span className="text-sm text-foreground">{item.description}</span>}
          <span className="text-sm">
            Created by {item.created_by.display_name} on {formatDateTime(item.created_at)}
          </span>
        </span>
        <span className="text-lg font-bold whitespace-nowrap text-foreground">{formatMoney(item.amount, item.currency)}</span>
      </Link>
    </li>
  );
}
