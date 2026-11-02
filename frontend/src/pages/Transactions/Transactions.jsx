import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PlusIcon } from 'lucide-react';
import { listCategoriesAndFamilies } from '@/api/expenses.js';
import { getFamily } from '@/api/families.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import { SelectField } from '@/components/FormField.jsx';
import FormSkeleton from '@/components/FormSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditLogList from './AuditLogList.jsx';
import TransactionFilters from './TransactionFilters.jsx';
import TransactionList from './TransactionList.jsx';
import {
  changeFilters, clearFilters, hasActiveFilters, parseFilters, toSearchParams,
} from './transactionFilters.js';

/** Tab triggers are at least 44px tall; the active one stands out on the card colour. */
const TAB = 'min-h-11 text-base data-[state=active]:bg-card';

/** The members of the selected family, for the member filter; none for Personal. */
function useMembers(familyId) {
  const load = useCallback(
    () => (familyId ? getFamily(familyId).then((family) => family.members) : Promise.resolve([])),
    [familyId],
  );
  return useAsyncList(load).data ?? [];
}

/**
 * Transactions in one space (Personal or a family): the list, or the audit log of
 * every action on them. The space, view, filters and page live in the URL.
 */
export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const options = useAsyncList(listCategoriesAndFamilies);
  const members = useMembers(filters.space);
  const apply = (next) => setSearchParams(toSearchParams(next));
  const change = (patch) => apply(changeFilters(filters, patch));
  const View = filters.view === 'audit' ? AuditLogList : TransactionList;

  return (
    <SectionCard aria-label="Transactions">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Transactions" description="Every expense in a space, and who added or changed it." />
        <Button asChild className="md:self-start">
          <Link to="/expenses/new"><PlusIcon />Add expense</Link>
        </Button>
      </div>
      {options.loading && !options.data && <FormSkeleton />}
      {options.error && <Notice>Could not load your families and categories. Please try again.</Notice>}
      {options.data && (
        <Tabs value={filters.view} onValueChange={(view) => change({ view })} className="gap-4">
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <SelectField
              id="space" label="Space" value={filters.space ?? ''}
              onChange={(value) => change({ space: value ? Number(value) : null })}
            >
              <NativeSelectOption value="">Personal</NativeSelectOption>
              {options.data.families.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>
              ))}
            </SelectField>
            <TabsList className="grid h-auto! w-full grid-cols-2">
              <TabsTrigger value="list" className={TAB}>Transactions</TabsTrigger>
              <TabsTrigger value="audit" className={TAB}>Audit log</TabsTrigger>
            </TabsList>
          </div>
          <TransactionFilters
            filters={filters} categories={options.data.categories} members={members}
            onChange={change} onClear={() => apply(clearFilters(filters))}
          />
          <Separator />
          <TabsContent value={filters.view}>
            <View
              filters={filters} search={`?${searchParams}`} filtered={hasActiveFilters(filters)}
              onPage={(page) => apply({ ...filters, page })}
            />
          </TabsContent>
        </Tabs>
      )}
    </SectionCard>
  );
}
