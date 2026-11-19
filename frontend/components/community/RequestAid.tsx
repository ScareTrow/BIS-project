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
}: {
  applicationId: ApplicationRef;
  responses: ApplicationResponse[];
  isAuthor: boolean;
  onChange: () => void;
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
    Promise.all([communityApi.aid(applicationId), communityApi.capabilities()])
      .then(([a, c]) => {
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
      .catch((e) => setMessage(e.message));
  }, [applicationId, responses]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      onChange();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  const canContribute =
    aid?.response_id &&
    responses.some((r) => r.id === aid.response_id && r.status === "accepted");
  const unrated = isAuthor && aid ? responses.filter(response =>
    response.status === 'completed' && !aid.rated_response_ids.includes(response.id)) : [];
  return (
    <>
    <section className="card my-6 space-y-4">
      <h2 className="text-xl font-semibold">Ресурсы и помощь</h2>
      <p>
        {catalog
          .filter((c) => aid?.capabilities.includes(c.id))
          .map((c) => c.name)
          .join(" · ") || "Специальные возможности не требуются"}
      </p>
      {!aid && !message && <p>Загрузка...</p>}
      {aid?.needs.map((n) => (
        <div className="border-t pt-4 space-y-2" key={n.id}>
          <h3 className="font-semibold">
            {n.resource_name} ({n.unit})
          </h3>
          <p>
            Нужно: {n.quantity_needed} ·
            Доставлено: {n.quantity_delivered}
          </p>
          <p>
            Осталось доставить: {n.still_needed}
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
                Доставлено
                <input
                  aria-label={`Доставлено ${n.resource_name}`}
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
                Сохранить доставленное количество
              </button>
            </form>
          )}
        </div>
      ))}
      {isAuthor &&
        responses
          .filter((r) => r.status === "accepted")
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
                Подтвердить завершение помощи
              </button>
            </div>
          ))}
    </section>
    {unrated.length > 0 && <section className="card my-6 space-y-4">
      <h2 className="text-xl font-semibold">{t('review.title')}</h2>
      {unrated.map(response => <div key={response.id} className="space-y-3 border-t pt-4">
        <p className="font-medium">{response.responder?.first_name || t('review.helper')}</p>
        <StarRating value={scores[response.id] ?? 5} label={t('ui.rating')}
          onChange={value => setScores(current => ({ ...current, [response.id]: value }))} />
        <Textarea id={`review-${response.id}`} label={t('review.comment')} maxLength={1000} rows={3}
          value={comments[response.id] ?? ''} onChange={event => setComments({ ...comments, [response.id]: event.target.value })} />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() =>
          perform(async () => {
            await communityApi.rateResponse(response.id, scores[response.id] ?? 5, comments[response.id]?.trim());
            setAid(current => current && ({ ...current, rated_response_ids: [...current.rated_response_ids, response.id] }));
          })}>{t('review.submit')}</button>
      </div>)}
    </section>}
      {message && (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      )}
    </>
  );
}
