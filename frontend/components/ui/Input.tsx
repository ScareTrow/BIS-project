import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type LabeledField = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

function Field({ id, label, hint, error, children }: LabeledField & { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-2">
      <label className="text-sm font-medium text-gray-700" htmlFor={id}>{label}</label>
      {children}
      {hint && <span id={`${id}-hint`} className="text-sm text-gray-600">{hint}</span>}
      {error && <span id={`${id}-error`} role="alert" className="text-sm text-danger-dark">{error}</span>}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string, extra?: string) {
  return [extra, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

type InputProps = ComponentPropsWithoutRef<'input'> & LabeledField;
type TextareaProps = ComponentPropsWithoutRef<'textarea'> & LabeledField;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  id, label, hint, error, className = '', 'aria-describedby': extra, 'aria-invalid': invalid, ...props
}, ref) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        {...props}
        ref={ref}
        id={id}
        className={`form-input motion-reduce:transition-none ${className}`}
        aria-describedby={describedBy(id, hint, error, extra)}
        aria-invalid={error ? true : invalid}
      />
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({
  id, label, hint, error, className = '', 'aria-describedby': extra, 'aria-invalid': invalid, ...props
}, ref) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        {...props}
        ref={ref}
        id={id}
        className={`form-textarea motion-reduce:transition-none ${className}`}
        aria-describedby={describedBy(id, hint, error, extra)}
        aria-invalid={error ? true : invalid}
      />
    </Field>
  );
});
