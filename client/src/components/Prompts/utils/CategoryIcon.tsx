import React from 'react';
import {
  Flask as BeakerIcon,
  Cube as BoxIcon,
  DiceFive as Dices,
  FileText,
  GraduationCap as GraduationCapIcon,
  Lightbulb as LightbulbIcon,
  ChartLine as LineChartIcon,
  PencilLine as PenLineIcon,
  AirplaneTakeoff as PlaneTakeoffIcon,
  GearSix as SettingsIcon,
  ShoppingBag as ShoppingBagIcon,
  TerminalWindow as TerminalSquareIcon,
  Users as UsersIcon,
} from '@phosphor-icons/react';
import { cn } from '~/utils';

const categoryIconMap: Record<string, React.ElementType> = {
  misc: BoxIcon,
  roleplay: Dices,
  write: PenLineIcon,
  idea: LightbulbIcon,
  shop: ShoppingBagIcon,
  finance: LineChartIcon,
  code: TerminalSquareIcon,
  travel: PlaneTakeoffIcon,
  teach_or_explain: GraduationCapIcon,
  general: BoxIcon,
  hr: UsersIcon,
  rd: BeakerIcon,
  it: TerminalSquareIcon,
  sales: LineChartIcon,
  aftersales: SettingsIcon,
};

const categoryColorMap: Record<string, string> = {
  code: 'text-series-5',
  misc: 'text-series-1',
  shop: 'text-series-6',
  idea: 'text-series-4',
  write: 'text-series-6',
  travel: 'text-series-4',
  finance: 'text-series-2',
  roleplay: 'text-series-2',
  teach_or_explain: 'text-series-1',
  general: 'text-series-1',
  hr: 'text-series-7',
  rd: 'text-series-6',
  it: 'text-series-5',
  sales: 'text-series-2',
  aftersales: 'text-series-4',
};

export default function CategoryIcon({
  category,
  icon,
  className = '',
}: {
  category: string;
  icon?: string;
  className?: string;
}) {
  if (icon) {
    return (
      <span className={cn('text-base leading-none', className)} aria-hidden="true">
        {icon}
      </span>
    );
  }

  const IconComponent = categoryIconMap[category] ?? FileText;
  const colorClass = categoryColorMap[category] ?? 'text-text-secondary';
  return <IconComponent className={cn('size-4', colorClass, className)} aria-hidden="true" />;
}
