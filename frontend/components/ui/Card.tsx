import type { ComponentPropsWithoutRef } from 'react';

export function Card({ className = '', ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`card p-4 sm:p-6 ${className}`} />;
}
