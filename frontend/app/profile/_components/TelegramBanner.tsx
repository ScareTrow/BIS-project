import { CheckCircle2, Send } from 'lucide-react';

type Props = { connected: boolean; onOpen: () => void };

/** Подключено — тихая зелёная строка. Не подключено — заметный жёлтый блок с действием. */
export default function TelegramBanner({ connected, onOpen }: Props) {
  if (connected) {
    return (
      <button type="button" onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Telegram подключён
        <span className="ml-auto text-xs font-normal underline">Настроить</span>
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Send className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-amber-900">Подключите Telegram</p>
          <p className="text-sm text-amber-800">Так вы получите сигналы о помощи рядом.</p>
        </div>
      </div>
      <button type="button" onClick={onOpen} className="btn btn-primary mt-3 w-full">
        Подключить Telegram
      </button>
    </div>
  );
}