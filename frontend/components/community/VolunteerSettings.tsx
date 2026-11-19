'use client';

import { useEffect, useState } from 'react';
import { ActionFeedback } from '@/components/ui/ActionFeedback';
import { Button } from '@/components/ui/Button';
import { CheckboxChipGroup } from '@/components/ui/CheckboxChipGroup';
import { communityApi, type Capability } from '@/lib/community-api';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export default function VolunteerSettings({ onDone }: { onDone?: () => void }) {
  const t = useTranslation(useStore(state => state.language));
  const [catalog, setCatalog] = useState<Capability[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message?: string; error?: boolean }>({});

  useEffect(() => {
    let active = true;
    Promise.all([communityApi.capabilities(), communityApi.preferences()]).then(([capabilities, preferences]) => {
      if (active) { setCatalog(capabilities); setIds(preferences.capability_ids); }
    }).catch(() => {
      if (active) setFeedback({ message: 'home.loadError', error: true });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save() {
    setBusy(true);
    try {
      await communityApi.savePreferences({ capability_ids: ids });
      setFeedback({ message: 'capability.saved' });
      onDone?.();
    } catch {
      setFeedback({ message: 'ui.action.error', error: true });
    } finally {
      setBusy(false);
    }
  }

  return <section className={onDone ? 'space-y-3' : 'card space-y-3'}>
    {loading ? <p role="status">{t('home.mapLoading')}</p> : <>
      <CheckboxChipGroup label={t('capability.title')} value={ids} onChange={setIds}
        options={catalog.map(item => {
          const key = `capability.${item.code}`;
          const label = t(key);
          return { value: item.id, label: label === key ? item.name : label };
        })} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} busy={busy} disabled={catalog.length === 0}>{t('capability.save')}</Button>
        {onDone && <Button variant="secondary" onClick={onDone} disabled={busy}>{t('capability.later')}</Button>}
      </div>
    </>}
    <ActionFeedback message={feedback.message && t(feedback.message)} error={feedback.error} />
  </section>;
}
