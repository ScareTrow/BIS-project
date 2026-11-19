'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type Option<Value extends string> = { value: Value; label: string; disabled?: boolean };

export function Select<Value extends string>({ label, value, options, onChange, disabled, error, hideLabel }: {
  label: string;
  value: Value;
  options: readonly Option<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  error?: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = options.findIndex(option => option.value === value);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const first = options.findIndex(option => !option.disabled);
  const last = options.reduce((index, option, i) => option.disabled ? index : i, -1);
  const show = (index: number) => {
    setActive(index);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && !option.disabled) {
      onChange(option.value);
      close();
    }
  };

  return <div ref={wrapper} className="relative min-w-0">
    <span id={`${id}-label`} className={hideLabel ? 'sr-only' : 'mb-2 block text-sm font-medium text-gray-700'}>{label}</span>
    <button ref={trigger} type="button" className={`form-select flex items-center justify-between gap-2 text-left ${error ? 'border-danger' : ''}`}
      aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-options` : undefined}
      aria-describedby={error ? `${id}-error` : undefined} disabled={disabled || first < 0}
      onClick={() => open ? close() : show(selected >= 0 && !options[selected].disabled ? selected : first)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          show(selected >= 0 && !options[selected].disabled ? selected : event.key === 'ArrowUp' ? last : first);
        }
      }}>
      <span id={`${id}-value`} className="min-w-0 break-words">{options[selected]?.label || label}</span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
    </button>
    {open && <ul ref={list} id={`${id}-options`} role="listbox" tabIndex={-1}
      aria-labelledby={`${id}-label`} aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
      className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-white p-1 shadow-sm focus:outline-none"
      onBlur={event => { if (!wrapper.current?.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === 'Tab') { close(); return; }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); return; }
        const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setActive(event.key === 'Home' ? first : last); }
        if (direction) {
          event.preventDefault();
          for (let i = active + direction; i >= 0 && i < options.length; i += direction) {
            if (!options[i].disabled) { setActive(i); break; }
          }
        }
      }}>
      {options.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option"
        aria-selected={index === selected} aria-disabled={option.disabled || undefined} data-active={index === active}
        className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 ${option.disabled ? 'text-gray-400' : 'cursor-pointer hover:bg-primary-light'} ${index === active ? 'bg-primary-light' : ''}`}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        {option.label}
        {index === selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
      </li>)}
    </ul>}
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-danger-dark">{error}</p>}
  </div>;
}
