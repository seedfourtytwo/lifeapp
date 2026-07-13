import type { ComponentType } from 'react';
import type { ActiveTimerSession, ElementDefinition, ElementKind, LifeEvent } from '../protocol';

export interface WidgetProps<TConfig = Record<string, unknown>> {
  element: ElementDefinition;
  config: TConfig;
  todayTotal: number;
  onLog?: (value: number, meta?: Record<string, unknown>) => Promise<void>;
  onSetDailyTotal?: (total: number) => Promise<void>;
  onOpenDetails?: () => void;
  isDone?: boolean;
  onToggle?: () => Promise<void>;
  streak?: number;
  failureStreak?: number;
  activeTimerSession?: ActiveTimerSession | null;
  onTimerPress?: () => void | Promise<void>;
  onTimerFinish?: () => void | Promise<void>;
  onResetToday?: () => void | Promise<void>;
}

export interface KindHandler<TConfig = Record<string, unknown>> {
  kind: ElementKind;
  defaultConfig: TConfig;
  aggregateDaily: (events: LifeEvent[]) => number;
  DashboardWidget: ComponentType<WidgetProps<TConfig>>;
}

/** Registry entry type — widgets receive config validated at render time. */
export type RegisteredKindHandler = KindHandler<Record<string, unknown>>;
