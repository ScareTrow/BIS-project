import { Star } from 'lucide-react';
import { useId } from 'react';

export function StarRating({ value, label, onChange }: {
  value: number;
  label: string;
  onChange?: (value: number) => void;
}) {
  const name = useId();
  const stars = [1, 2, 3, 4, 5];
  const icon = (score: number) => <Star aria-hidden="true" className={`h-4 w-4 ${score <= value ? 'fill-amber-500 text-amber-700' : 'text-gray-500'}`} />;
  if (!onChange) return <span role="img" aria-label={label} className="inline-flex items-center gap-0.5">{stars.map(score =>
    <span key={score}>{icon(score)}</span>)}</span>;
  return <fieldset className="flex flex-wrap gap-1">
    <legend className="sr-only">{label}</legend>
    {stars.map(score => <label key={score} className="relative cursor-pointer">
      <input className="peer sr-only" type="radio" name={name} value={score} checked={score === value}
        onChange={() => onChange(score)} aria-label={String(score)} />
      <span className="grid h-9 w-9 place-items-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-primary">{icon(score)}</span>
    </label>)}
  </fieldset>;
}
