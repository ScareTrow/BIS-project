"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Capability, communityApi } from "@/lib/community-api";

export default function VolunteerSettings() {
  const [catalog, setCatalog] = useState<Capability[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<{ id: number; description: string }[]>(
    [],
  );
  useEffect(() => {
    Promise.all([
      communityApi.capabilities(),
      communityApi.preferences(),
      communityApi.matching(),
    ])
      .then(([c, p, m]) => {
        setCatalog(c);
        setIds(p.capability_ids);
        setAvailable(p.is_available);
        setMatches(m);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await communityApi.savePreferences({
        capability_ids: ids,
        is_available: available,
      });
      setMatches(await communityApi.matching());
      setMessage("Настройки сохранены");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card my-6 space-y-4">
      <h2 className="text-xl font-semibold">Мои возможности помочь</h2>
      <p>
        Вы можете и просить помощь, и помогать другим. Для подбора укажите город
        в профиле.
      </p>
      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Могу помочь сейчас
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            {catalog.map((c) => (
              <label className="flex gap-2" key={c.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(c.id)}
                  onChange={(e) =>
                    setIds(
                      e.target.checked
                        ? [...ids, c.id]
                        : ids.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Сохранение..." : "Сохранить возможности"}
          </button>
          <h3 className="font-semibold">Подходящие заявки</h3>
          {matches.length ? (
            matches.map((m) => (
              <p key={m.id}>
                <Link
                  className="text-blue-700 underline"
                  href={`/applications/${m.id}`}
                >
                  {m.description}
                </Link>
              </p>
            ))
          ) : (
            <p>
              Совпадений пока нет. Проверьте город, возможности и доступность.
            </p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
