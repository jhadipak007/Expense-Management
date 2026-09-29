import { Link } from 'react-router';

/** Text link back to a parent page, at least 44px tall. */
export default function BackLink(props) {
  return <Link className="flex min-h-11 items-center self-start text-primary underline" {...props} />;
}
