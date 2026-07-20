import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import { getKindHandler } from '../../kinds/registry';
import type { RootStackParamList } from '../../navigation/types';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import { useEventStore } from '../../store/eventStore';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
};

export default function HabitCard({ habit, config }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { handleTimerPress, handleFinishTimer, handleResetToday } = useHabitTimerControls();
  const {
    todayTotal,
    isDone,
    streak,
    failureStreak,
    activeTimerSession,
    toggleHabit,
  } = useEventStore(
    useShallow((state) => ({
      todayTotal: state.dailyTotals[habit.id] ?? 0,
      isDone: state.habitDoneToday[habit.id] ?? false,
      streak: state.habitStreaks[habit.id] ?? 0,
      failureStreak: state.habitFailureStreaks[habit.id] ?? 0,
      activeTimerSession: state.activeTimerSessions[habit.id] ?? null,
      toggleHabit: state.toggleHabit,
    })),
  );

  const habitHandler = getKindHandler('habit');
  if (!habitHandler) return null;

  const Widget = habitHandler.DashboardWidget;

  return (
    <Widget
      element={habit}
      config={config}
      todayTotal={todayTotal}
      isDone={isDone}
      streak={streak}
      failureStreak={failureStreak}
      activeTimerSession={activeTimerSession}
      onToggle={() => toggleHabit(habit.id, config)}
      onTimerPress={() => handleTimerPress(habit.id, config)}
      onTimerFinish={() => handleFinishTimer(habit.id, config)}
      onResetToday={() => handleResetToday(habit.id, config)}
      onOpenDetails={() => navigation.navigate('TrackerHistory', { elementId: habit.id })}
    />
  );
}
