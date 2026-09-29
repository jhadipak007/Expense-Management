/** Nothing to show yet: an icon, a short message and, optionally, an action (children). */
export default function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted" aria-hidden="true">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="text-sm">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
