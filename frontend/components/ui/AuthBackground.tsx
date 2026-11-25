import type { ReactNode } from 'react';

export default function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-sky-200 via-blue-200 to-blue-300">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 -z-10 h-96 w-96 rounded-full bg-blue-500/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-indigo-400/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute right-1/4 top-1/3 -z-10 h-72 w-72 rounded-full bg-sky-400/30 blur-3xl" />
      {children}
    </div>
  );
}

/** Обёртка для белой карточки формы: тень и тонкая светлая обводка. */
export function AuthCardShell({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl shadow-2xl shadow-blue-900/20 ring-1 ring-white/70">{children}</div>;
}