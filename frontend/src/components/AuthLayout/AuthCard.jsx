import { PageTitle } from '@/components/SectionCard.jsx';
import { Card } from '@/components/ui/card';

/** Card holding one auth form, with its title and subtitle. */
export default function AuthCard({ title, subtitle, onSubmit, children }) {
  return (
    <Card className="w-full max-w-md gap-4 p-6">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <PageTitle>{title}</PageTitle>
        <p>{subtitle}</p>
        {children}
      </form>
    </Card>
  );
}
