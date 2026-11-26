"use client";
import { useEffect, useState } from "react";
import { Aid, Capability, communityApi } from "@/lib/community-api";
import { ApplicationRef, ApplicationResponse } from "@/lib/api";
import { StarRating } from '@/components/ui/StarRating';
import { Textarea } from '@/components/ui/Input';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export default function RequestAid({
  applicationId,
  responses,
  isAuthor,
  onChange,
  revision = 0,
  showRatings = false,
}: {
  applicationId: ApplicationRef;
  responses: ApplicationResponse[];
  isAuthor: boolean;
  onChange: () => void | Promise<void>;
  revision?: number;
  showRatings?: boolean;
}) {
  const [aid, setAid] = useState<Aid | null>(null);
  const [catalog, setCatalog] = useState<Capability[]>([]);
  const [values, setValues] = useState<
    Record<number, { delivered: number }>
  >({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const t = useTranslation(useStore(state => state.language));
  useEffect(() => {
    let active = true;
    Promise.all([communityApi.aid(applicationId), communityApi.capabilities()])
      .then(([a, c]) => {
        if (!active) return;
        setAid(a);
        setCatalog(c);
        const next: typeof values = {};
        a.needs.forEach((n) => {
          const mine = a.contributions.find(
            (e) => e.need_id === n.id && e.response_id === a.response_id,
          );
          next[n.id] = {
            delivered: mine?.quantity_delivered ?? 0,
          };
        });
        setValues(next);
      })
      .catch((e) => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [applicationId, revision]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await onChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('ui.action.error'));
    } finally {
      setBusy(false);
    }
  }

  const canContribute = aid?.response_id &&
    responses.some(response => response.id === aid.response_id && response.status === 'accepted');
  const unrated = isAuthor && aid ? responses.filter(response =>
    response.status === 'completed' && !aid.rated_response_ids.includes(response.id)) : [];
  const accepted = responses.filter(response => response.status === 'accepted');
  const capabilities = catalog.filter(item => aid?.capabilities.includes(item.id));
  const showNeeds = aid && (aid.capabilities.length > 0 || aid.needs.length > 0 || (isAuthor && accepted.length > 1));
  return (
    <>
    {showRatings && unrated.length > 0 && <section className="card my-6 space-y-4">
      <h2 className="text-xl font-semibold">{t('review.title')}</h2>
      {unrated.map(response => <div key={response.id} className="space-y-3 border-t pt-4">
        <p className="font-medium">{response.responder?.first_name || t('review.helper')}</p>
        <StarRating value={scores[response.id] ?? 0} label={t('ui.rating')}
          onChange={value => setScores(current => ({ ...current, [response.id]: value }))} />
        <Textarea id={`review-${response.id}`} label={t('review.comment')} maxLength={1000} rows={3}
          value={comments[response.id] ?? ''} onChange={event => setComments({ ...comments, [response.id]: event.target.value })} />
        <button type="button" className="btn btn-primary" disabled={busy || !scores[response.id]} onClick={() =>
          perform(async () => {
            await communityApi.rateResponse(response.id, scores[response.id] ?? 0, comments[response.id]?.trim());
            setAid(current => current && ({ ...current, rated_response_ids: [...current.rated_response_ids, response.id] }));
          })}>{t('review.submit')}</button>
      </div>)}
    </section>}
    {showNeeds && <section className="card space-y-4">
      {capabilities.length > 0 && <>
        <h2 className="text-xl font-semibold">{t('request.helperRequirements')}</h2>
        <ul className="flex flex-wrap gap-2">{capabilities.map(item => {
          const key = 'capability.' + item.code;
          const label = t(key);
          return <li className="rounded-full bg-blue-50 px-3 py-1 text-sm" key={item.id}>{label === key ? item.name : label}</li>;
        })}</ul>
      </>}
      {aid?.needs.map((n) => (
        <div className="border-t pt-4 space-y-2" key={n.id}>
          <h3 className="font-semibold">
            {n.resource_name} ({n.unit})
          </h3>
          <p>
            {t('request.quantityNeeded', { count: n.quantity_needed })} · {t('request.quantityDelivered', { count: n.quantity_delivered })}
          </p>
          <p>
            {n.confirmed_by_author ? t('request.quantityConfirmed') : t('request.quantityRemaining', { count: n.still_needed })}
          </p>
          {canContribute && values[n.id] && (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                perform(() =>
                  communityApi.contribute(aid.response_id!, {
                    need_id: n.id,
                    quantity_delivered: values[n.id].delivered,
                  }),
                );
              }}
            >
              <label className="form-field">
                {t('request.delivered')}
                <input
                  aria-label={t('request.delivered') + ' ' + n.resource_name}
                  className="form-input w-32"
                  type="number"
                  min={aid.contributions.find(c => c.need_id === n.id && c.response_id === aid.response_id)?.quantity_delivered || 0}
                  step="0.001"
                  max={(aid.contributions.find(c => c.need_id === n.id && c.response_id === aid.response_id)?.quantity_delivered || 0) + n.still_needed}
                  required
                  value={values[n.id].delivered}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [n.id]: {
                        ...values[n.id],
                        delivered: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <button disabled={busy} className="btn btn-primary">
                {t('request.saveDelivered')}
              </button>
            </form>
          )}
        </div>
      ))}
      {isAuthor && accepted.length > 1 &&
        accepted
          .map((r) => (
            <div className="flex flex-wrap gap-3 items-center" key={r.id}>
              <span>
                {r.responder?.first_name || `Волонтёр #${r.responder_id}`}
              </span>
              <button
                disabled={busy}
                className="btn btn-primary"
                onClick={() =>
                  perform(() => communityApi.completeResponse(r.id))
                }
              >
                {t('request.helperFinished')}
              </button>
            </div>
          ))}
    </section>}
      {message && (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      )}
    </>
  );
}
