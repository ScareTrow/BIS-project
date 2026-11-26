export function formatKzPhone(digits: string): string {
  const d = (digits || '').replace(/\D/g, '').slice(0, 10);
  const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 8), e = d.slice(8, 10);
  let out = a ? `(${a}` : '';
  if (a.length === 3 && (b || d.length === 3)) out += ')';
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (e) out += `-${e}`;
  return out;
}