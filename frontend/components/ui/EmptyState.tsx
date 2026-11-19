import type { ReactNode } from 'react';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';

type EmptyStateProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function EmptyState({ title, description, actions }: EmptyStateProps) {
  return (
    <Card className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {description && <p className="text-gray-600">{description}</p>}
      {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
    </Card>
  );
}
