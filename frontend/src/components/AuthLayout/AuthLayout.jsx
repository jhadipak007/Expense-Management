const HIGHLIGHTS = [
  'Track grocery, eating out and trips in one place',
  'Share expenses and reports with your family',
  'See totals by currency at a glance',
];

/**
 * Page shell for the login and sign-up screens: a brand block (a band on top
 * below 1024px, a side panel from 1024px) next to the form.
 */
export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <div className="flex flex-col items-center gap-3 bg-linear-160 from-brand to-brand-deep px-4 py-6 text-center text-brand-foreground lg:max-w-lg lg:flex-[0_0_40%] lg:items-start lg:justify-center lg:gap-6 lg:p-8 lg:text-left">
        <img src="/logo-dark.svg" alt="Expense Sarathi" className="h-10 max-w-full lg:h-16" />
        <p className="lg:text-xl">Your guide to everyday spending.</p>
        <ul className="hidden lg:flex lg:flex-col lg:gap-4">
          {HIGHLIGHTS.map((text) => (
            <li
              key={text}
              className="flex gap-3 before:mt-2 before:size-2.5 before:flex-none before:rounded-full before:bg-accent"
            >
              {text}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 py-6 lg:items-center lg:p-8">{children}</div>
    </main>
  );
}
