import { AlertTriangle, HandHeart, Home, Pill, Shirt, ShoppingBasket, Truck, Users, Wrench, type LucideIcon } from 'lucide-react';
import type { ApplicationCategory } from './api';

export const CATEGORY_META: Record<ApplicationCategory, {
  Icon: LucideIcon;
  color: string;
  labelKey: string;
}> = {
  food: { Icon: ShoppingBasket, color: '#15803d', labelKey: 'categories.food' },
  clothing: { Icon: Shirt, color: '#7c3aed', labelKey: 'categories.clothing' },
  household: { Icon: Wrench, color: '#b45309', labelKey: 'categories.household' },
  delivery: { Icon: Truck, color: '#0e7490', labelKey: 'categories.delivery' },
  volunteering: { Icon: HandHeart, color: '#be185d', labelKey: 'categories.volunteering' },
  social_project: { Icon: Users, color: '#4f46e5', labelKey: 'categories.social_project' },
  medicine: { Icon: Pill, color: '#0f766e', labelKey: 'categories.medicine' },
  shelter: { Icon: Home, color: '#2563eb', labelKey: 'categories.shelter' },
  emergency: { Icon: AlertTriangle, color: '#c2410c', labelKey: 'categories.emergency' },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as ApplicationCategory[];
