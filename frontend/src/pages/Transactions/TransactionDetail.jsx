import { useCallback, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { PencilIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { listExpenseFormOptions } from '@/api/expenses.js';
import {
  deleteTransaction, getTransaction, restoreTransaction, updateTransaction,
} from '@/api/transactions.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import BackLink from '@/components/BackLink.jsx';
import ConfirmButton from '@/components/ConfirmButton.jsx';
import ListSkeleton from '@/components/ListSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading, PageTitle } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatIsoDate, formatMoney } from '@/utils/format.js';
import ExpenseForm from '../Expenses/ExpenseForm.jsx';
import { ActionBadge, AuditChanges, DeletedBadge } from './auditDisplay.jsx';

/** e.g. "AUD 12.50 for Grocery", for toasts. */
const describe = (expense) => `${formatMoney(expense.amount, expense.currency)} for ${expense.category.name}`;

async function loadDetail(id, signal) {
  const [transaction, options] = await Promise.all([getTransaction(id, signal), listExpenseFormOptions()]);
  return { transaction, options };
}

/**
 * One transaction: its fields, who created and last changed it, and its full history.
 * Its recorder can edit it in place, delete it, or restore it once deleted.
 */
export default function TransactionDetail() {
  const { expenseId } = useParams();
  const back = { pathname: '/transactions', search: useLocation().search };
  const load = useCallback((signal) => loadDetail(expenseId, signal), [expenseId]);
  const { data, error, loading, reload } = useAsyncList(load);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState('');

  if (loading && !data) return <SectionCard><ListSkeleton /></SectionCard>;
  if (error) {
    return (
      <SectionCard>
        <Notice>{error.status === 404 ? 'Transaction not found.' : 'Could not load this transaction.'}</Notice>
        <BackLink to={back}>Back to transactions</BackLink>
      </SectionCard>
    );
  }

  const { transaction: t, options } = data;
  async function run(action, message) {
    setActionError('');
    try {
      await action(t.id);
      toast.success(message, { description: describe(t) });
    } catch (failure) {
      setActionError(failure.body?.detail ? `${failure.body.detail}.` : 'Could not save the change. Please try again.');
    }
    reload();
  }

  async function save(payload) {
    const saved = await updateTransaction(t.id, payload);
    toast.success('Expense updated', { description: describe(saved) });
    setEditing(false);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard aria-label="Transaction">
        <BackLink to={back}>Back to transactions</BackLink>
        <div className="flex flex-wrap items-center gap-2">
          <PageTitle>{formatMoney(t.amount, t.currency)}</PageTitle>
          {t.deleted_at && <DeletedBadge />}
        </div>
        {actionError && <Notice>{actionError}</Notice>}
        {editing ? (
          <ExpenseForm
            categories={options.categories} currencies={options.currencies} families={options.families}
            expense={t} onSubmit={save}
          >
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </ExpenseForm>
        ) : (
          <>
            <Fields transaction={t} families={options.families} />
            {t.can_edit && (
              <div className="flex flex-col gap-2 md:flex-row">
                {t.deleted_at ? (
                  <Button variant="outline" onClick={() => run(restoreTransaction, 'Expense restored')}>
                    <RotateCcwIcon />Restore
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setEditing(true)}><PencilIcon />Edit</Button>
                    <ConfirmButton
                      variant="outline" className="text-destructive"
                      title="Delete this expense?"
                      description="It leaves your lists, totals and budgets, but stays in the audit log and can be restored."
                      confirmLabel="Delete" cancelLabel="Keep it"
                      onConfirm={() => run(deleteTransaction, 'Expense deleted')}
                    >
                      <Trash2Icon />Delete
                    </ConfirmButton>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </SectionCard>
      <SectionCard aria-labelledby="history-heading">
        <CardHeading id="history-heading">History</CardHeading>
        <ol className="flex flex-col gap-2">
          {t.history.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 rounded-md border p-3">
              <span className="flex flex-wrap items-center gap-2">
                <ActionBadge action={entry.action} />
                <span className="text-sm">
                  By {entry.performed_by.display_name} on {formatDateTime(entry.created_at)}
                </span>
              </span>
              <AuditChanges changes={entry.changes} />
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

/** The transaction's fields and audit metadata as a description list. */
function Fields({ transaction: t, families }) {
  const rows = [
    ['Category', t.category.name],
    ['Date of expense', formatIsoDate(t.spent_on)],
    ['Description', t.description || 'None'],
    ['Shared with', families.find((f) => f.id === t.family_id)?.name ?? 'Personal'],
    ['Created by', t.created_by.display_name],
    ['Created on', formatDateTime(t.created_at)],
    ['Last modified by', t.last_modified_by?.display_name ?? 'Not changed since created'],
    ['Last modified on', t.last_modified_at ? formatDateTime(t.last_modified_at) : 'Not changed since created'],
  ];
  if (t.deleted_at) rows.push(['Deleted on', formatDateTime(t.deleted_at)]);
  return (
    <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-sm">{label}</dt>
          <dd className="font-semibold wrap-anywhere text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
