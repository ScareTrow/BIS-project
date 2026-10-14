'use client';

import { AlertCircle, Home, Pill, ShoppingCart } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { ApplicationCategory } from '@/lib/api';

interface CategoryBadgeProps {
  category: ApplicationCategory;
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  const { language } = useStore();
  const t = useTranslation(language);

  const categoryConfig = {
    food: { 
      label: t('categories.food'), 
      className: 'badge-success', 
      icon: ShoppingCart,
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-300'
    },
    medicine: { 
      label: t('categories.medicine'), 
      className: 'badge-danger', 
      icon: Pill,
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-300'
    },
    shelter: { 
      label: t('categories.shelter'), 
      className: 'badge-primary', 
      icon: Home,
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-300'
    },
    emergency: { 
      label: t('categories.emergency'), 
      className: 'badge-emergency', 
      icon: AlertCircle,
      bgColor: 'bg-red-500',
      textColor: 'text-white',
      borderColor: 'border-red-600'
    },
    ...Object.fromEntries(['clothing', 'household', 'delivery', 'volunteering', 'social_project'].map(key => [key, {
      label: t(`categories.${key}`), className: 'badge-primary', icon: Home,
      bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-300',
    }])),
  };

  const config = (categoryConfig as Record<string, typeof categoryConfig.food>)[category] || categoryConfig.food;
  const Icon = config.icon;

  return (
    <span className={`badge ${config.className} ${config.bgColor} ${config.textColor} ${config.borderColor} flex items-center space-x-1.5 px-2.5 py-1 font-semibold text-xs`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </span>
  );
}
