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

/** Heading of a card. */
export function CardHeading({ className, ...props }) {
  return <h2 className={cn('text-xl font-bold wrap-anywhere text-foreground', className)} {...props} />;
}
