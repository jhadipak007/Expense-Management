import { cn } from 'cn';
import { Card } from '@/components/ui/card';

/** A page card that is also a landmark: pass aria-label or aria-labelledby to name the region. */
export default function SectionCard({ className, children, ...sectionProps }) {
  return (
    <section {...sectionProps}>
      <Card className={cn('h-full gap-4 p-4 md:p-6', className)}>{children}</Card>
    </section>
  );
}

/** The page's h1. */
export function PageTitle({ className, ...props }) {
  return <h1 className={cn('text-2xl font-bold wrap-anywhere text-foreground md:text-3xl', className)} {...props} />;
}

/** The page's h1 with a short description under it. */
export function PageHeader({ id, title, description }) {
  return (
    <div className="flex flex-col gap-1">
      <PageTitle id={id}>{title}</PageTitle>
      <p className="text-sm">{description}</p>
    </div>
  );
}

/** Heading of a card; an h2 unless `as` names another level. */
export function CardHeading({ as: Heading = 'h2', className, ...props }) {
  return <Heading className={cn('text-xl font-bold wrap-anywhere text-foreground', className)} {...props} />;
}

/** A card's heading (level from `as`) and short description, with an optional icon tile on the right. */
export function CardIntro({ id, as, title, description, icon: Icon, iconClassName }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <CardHeading id={id} as={as}>{title}</CardHeading>
        {description && <p className="text-sm">{description}</p>}
      </div>
      {Icon && (
        <span
          className={cn('grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary', iconClassName)}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
      )}
    </div>
  );
}
