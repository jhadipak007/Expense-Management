import { Card } from '@/components/ui/card';

/** Card holding one auth form, with its title and subtitle. */
export default function AuthCard({ title, subtitle, onSubmit, children }) {
  return (
    <Card className="w-full max-w-md gap-4 p-6">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        <p>{subtitle}</p>
        {children}
      </form>
    </Card>
  );
}
