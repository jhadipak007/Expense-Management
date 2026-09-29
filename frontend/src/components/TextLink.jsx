import { cn } from 'cn';
import { Link } from 'react-router';

/** An underlined in-text link. */
export default function TextLink({ className, ...props }) {
  return <Link className={cn('text-primary underline', className)} {...props} />;
}
