import type { ComponentPropsWithoutRef } from 'react';

const widths = {
  wide: 'max-w-7xl',
  content: 'max-w-4xl',
  form: 'max-w-3xl',
};

type PageContainerProps = ComponentPropsWithoutRef<'div'> & { width?: keyof typeof widths };

export function PageContainer({ width = 'wide', className = '', ...props }: PageContainerProps) {
  return (
    <div
      {...props}
      className={`mx-auto w-full ${widths[width]} space-y-6 px-4 py-6 sm:px-6 lg:space-y-8 lg:px-8 lg:py-8 ${className}`}
    />
  );
}
