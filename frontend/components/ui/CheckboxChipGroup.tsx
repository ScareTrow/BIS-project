export function CheckboxChipGroup<Value extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: readonly { value: Value; label: string }[];
  value: readonly Value[];
  onChange: (values: Value[]) => void;
}) {
  return <fieldset className="min-w-0">
    <legend className="mb-2 text-sm font-semibold text-gray-900">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map(option => <label key={option.value} className="relative cursor-pointer">
        <input type="checkbox" className="peer sr-only" checked={value.includes(option.value)} onChange={event =>
          onChange(event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))} />
        <span className="inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary-dark peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
          {option.label}
        </span>
      </label>)}
    </div>
  </fieldset>;
}
