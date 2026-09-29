import { listFamilies } from '@/api/families.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import ItemRow, { ItemList } from '@/components/ItemRow.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageTitle } from '@/components/SectionCard.jsx';
import TextLink from '@/components/TextLink.jsx';
import CreateFamilyForm from './CreateFamilyForm.jsx';
import RoleBadge from './RoleBadge.jsx';

/** The user's families with their role in each, and a form to create one. */
export default function Families() {
  const { data: families, error, loading, reload } = useAsyncList(listFamilies);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard>
        <PageTitle>Families</PageTitle>
        {loading && <p className="text-sm">Loading...</p>}
        {error && <Notice>Could not load your families.</Notice>}
        {families?.length === 0 && (
          <p className="text-sm">You are not in a family yet. Create one below.</p>
        )}
        {families?.length > 0 && (
          <ItemList>
            {families.map((family) => (
              <ItemRow key={family.id}>
                <TextLink
                  className="flex min-h-11 items-center self-start font-semibold wrap-anywhere"
                  to={`/families/${family.id}`}
                >
                  {family.name}
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
