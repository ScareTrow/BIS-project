import type { LucideIcon } from 'lucide-react';

export type StatItem = { label: string; value: number; icon: LucideIcon; tone: 'blue' | 'emerald' | 'rose' | 'amber' };

const tones = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
};

/** Четыре показателя в одной карточке: на телефоне занимает ~80px вместо ~260px. */
export default function StatsCard({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-4 divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="flex flex-col items-center gap-1 px-1 py-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tones[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="text-xs text-gray-600">{label}</p>
        </div>
      ))}
    </div>
  );
}