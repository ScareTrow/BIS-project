'use client';

import { CATEGORY_META } from '@/lib/categories';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import type { ApplicationCategory } from '@/lib/api';

export default function CategoryBadge({ category }: { category: ApplicationCategory }) {
  const t = useTranslation(useStore(state => state.language));
  const { Icon, color, labelKey } = CATEGORY_META[category] || CATEGORY_META.food;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-semibold"
      style={{ color, borderColor: color }}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t(labelKey)}
    </span>
  );
}
