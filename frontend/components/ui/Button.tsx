import type { ComponentPropsWithoutRef } from 'react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const sizes = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-base',
  lg: 'min-h-12 px-6 py-2.5 text-base',
};

type ButtonAppearance = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className = '',
}: ButtonAppearance = {}) {
  return `btn ${variants[variant]} ${sizes[size]} inline-flex items-center justify-center gap-2 motion-reduce:transition-none ${className}`;
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & ButtonAppearance & {
  busy?: boolean;
};

export function Button({
  variant,
  size,
  className,
  type = 'button',
  disabled,
  busy = false,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    />
  );
}
