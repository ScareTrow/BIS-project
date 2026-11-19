'use client';

import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { Badge } from './Badge';

const tones = {
  open: 'info', pending: 'warning', in_progress: 'warning', completed: 'success',
  approved: 'success', rejected: 'danger', false_call: 'danger', expired: 'neutral',
} as const;

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslation(useStore(state => state.language));
  const known = Object.hasOwnProperty.call(tones, status);
  return <Badge tone={known ? tones[status as keyof typeof tones] : 'neutral'}>
    {t(known ? `status.${status}` : 'status.unknown')}
  </Badge>;
}
