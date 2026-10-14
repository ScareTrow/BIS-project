"use client";
import { useEffect, useState } from "react";
import { Aid, Capability, communityApi } from "@/lib/community-api";
import { ApplicationResponse } from "@/lib/api";

export default function RequestAid({
  applicationId,
  responses,
  isAuthor,
  onChange,
}: {
  applicationId: number;
  responses: ApplicationResponse[];
  isAuthor: boolean;
  onChange: () => void;
}) {
  const [aid, setAid] = useState<Aid | null>(null);
  const [catalog, setCatalog] = useState<Capability[]>([]);
  const [values, setValues] = useState<
    Record<number, { promised: number; delivered: number }>
  >({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({});
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
            promised: mine?.quantity_promised ?? Math.min(n.unpromised, 1),
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
  return (
    <section className="card my-6 space-y-4">
      <h2 className="text-xl font-semibold">Какая помощь нужна</h2>
      {aid?.needed_help && <p>{aid.needed_help}</p>}
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
            Нужно: {n.quantity_needed} · Обещано: {n.quantity_promised} ·
            Доставлено: {n.quantity_delivered}
          </p>
          <p>
            Ещё получить: {n.still_needed} · Можно обещать: {n.unpromised}
          </p>
          {canContribute && values[n.id] && (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                perform(() =>
                  communityApi.contribute(aid.response_id!, {
                    need_id: n.id,
                    quantity_promised: values[n.id].promised,
                    quantity_delivered: values[n.id].delivered,
                  }),
                );
              }}
            >
              <label>
                Обещаю
                <input
                  aria-label={`Обещаю ${n.resource_name}`}
                  className="block border p-2 w-32"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={values[n.id].promised}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [n.id]: {
                        ...values[n.id],
                        promised: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Доставлено
                <input
                  aria-label={`Доставлено ${n.resource_name}`}
                  className="block border p-2 w-32"
                  type="number"
                  min="0"
                  step="0.001"
                  max={values[n.id].promised}
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
                Сохранить мой взнос
              </button>
            </form>
          )}
        </div>
      ))}
      {isAuthor &&
        responses
          .filter((r) => r.status === "accepted")
          .map((r) => (
            <div className="flex gap-3 items-center" key={r.id}>
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
      {isAuthor &&
        responses
          .filter((r) => r.status === "completed")
          .map((r) => (
            <div className="flex flex-wrap gap-3 items-center" key={r.id}>
              <span>
                Оценка помощи:{" "}
                {r.responder?.first_name || `Волонтёр #${r.responder_id}`}
              </span>
              <select
                aria-label="Оценка помощи"
                className="border p-2"
                value={scores[r.id] || 5}
                onChange={(e) =>
                  setScores({ ...scores, [r.id]: Number(e.target.value) })
                }
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}/5
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={busy || aid?.rated_response_ids.includes(r.id)}
                onClick={() =>
                  perform(() =>
                    communityApi.rateResponse(r.id, scores[r.id] || 5),
                  )
                }
              >
                {aid?.rated_response_ids.includes(r.id)
                  ? "Оценка сохранена"
                  : "Оценить помощь"}
              </button>
            </div>
          ))}
      {message && (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      )}
    </section>
  );
}
