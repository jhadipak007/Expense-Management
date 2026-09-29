import TextLink from '@/components/TextLink.jsx';

/** Text link back to a parent page, at least 44px tall. */
export default function BackLink(props) {
  return <TextLink className="flex min-h-11 items-center self-start" {...props} />;
}
