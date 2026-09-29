import { ChevronRightIcon, UsersIcon } from 'lucide-react';
import { listFamilies } from '@/api/families.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import EmptyState from '@/components/EmptyState.jsx';
import ItemRow, { ItemList } from '@/components/ItemRow.jsx';
import ListSkeleton from '@/components/ListSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import TextLink from '@/components/TextLink.jsx';
import CreateFamilyForm from './CreateFamilyForm.jsx';
import RoleBadge from './RoleBadge.jsx';

/** The user's families with their role in each, and a form to create one. */
export default function Families() {
  const { data: families, error, loading, reload } = useAsyncList(listFamilies);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Families" description="Share expenses and reports with the people you live or travel with." />
      <SectionCard aria-label="Your families">
        {loading && !families && <ListSkeleton />}
        {error && <Notice>Could not load your families.</Notice>}
        {families?.length === 0 && (
          <EmptyState
            icon={UsersIcon} title="You are not in a family yet"
            description="Create one below, or accept an invitation from your dashboard."
          />
        )}
        {families?.length > 0 && (
          <ItemList>
            {families.map((family) => (
              <ItemRow key={family.id}>
                <TextLink
                  className="flex min-h-11 items-center gap-1 self-start font-semibold wrap-anywhere"
                  to={`/families/${family.id}`}
                >
                  {family.name}
                  <ChevronRightIcon className="size-4" aria-hidden="true" />
                </TextLink>
                <RoleBadge role={family.role} />
              </ItemRow>
            ))}
          </ItemList>
        )}
      </SectionCard>
      <CreateFamilyForm onCreated={reload} />
    </div>
  );
}
