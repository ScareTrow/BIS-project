import { Instagram, Send } from 'lucide-react';

type Props = { value: unknown };

function parseLinks(value: unknown): Record<string, string> | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* некорректный JSON — просто не показываем ссылки */
  }
  return null;
}

const toUrl = (raw: string, base: string) =>
  raw.startsWith('http') ? raw : `${base}${raw.replace('@', '')}`;

export default function SocialLinks({ value }: Props) {
  const links = parseLinks(value);
  if (!links) return null;

  const linkClass = 'flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200';

  return (
    <div className="flex gap-2">
      {links.instagram && (
        <a href={toUrl(links.instagram, 'https://instagram.com/')} target="_blank" rel="noopener noreferrer"
          className={`${linkClass} text-pink-600`} aria-label="Instagram" title="Instagram">
          <Instagram className="h-5 w-5" />
        </a>
      )}
      {links.telegram && (
        <a href={toUrl(links.telegram, 'https://t.me/')} target="_blank" rel="noopener noreferrer"
          className={`${linkClass} text-blue-500`} aria-label="Telegram" title="Telegram">
          <Send className="h-5 w-5" />
        </a>
      )}
      {links.vk && (
        <a href={toUrl(links.vk.replace('https://vk.com/', ''), 'https://vk.com/')} target="_blank" rel="noopener noreferrer"
          className={`${linkClass} text-sm font-bold text-blue-700`} aria-label="VK" title="VK">
          VK
        </a>
      )}
    </div>
  );
}