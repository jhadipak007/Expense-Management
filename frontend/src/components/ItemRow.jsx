/** A bordered list row; its details stack on phones and sit beside the actions from 768px. */
export default function ItemRow({ children }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
      {children}
    </li>
  );
}

/** The text side of a row. */
export function ItemDetails({ children }) {
  return <div className="flex min-w-0 flex-col gap-1 wrap-anywhere">{children}</div>;
}

/** Row buttons: equal width on phones, natural width from 768px. */
export function ItemActions({ children }) {
  return <div className="flex gap-2 *:flex-1 md:*:flex-none">{children}</div>;
}
