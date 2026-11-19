import type { ReactNode } from 'react';

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="text-xl font-semibold text-gray-900">{children}</h2>;
}
