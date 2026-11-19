import type { ComponentPropsWithoutRef } from 'react';

const tones = {
  neutral: 'border border-gray-200 bg-gray-50 text-gray-700',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-primary',
};

type BadgeProps = ComponentPropsWithoutRef<'span'> & { tone?: keyof typeof tones };

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`badge inline-flex items-center gap-1 text-sm font-medium normal-case tracking-normal ${tones[tone]} ${className}`}
    />
  );
}
