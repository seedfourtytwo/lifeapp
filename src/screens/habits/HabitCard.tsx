import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import { getKindHandler } from '../../kinds/registry';
import type { RootStackParamList } from '../../navigation/types';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import { useEventStore } from '../../store/eventStore';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  hasTodayNote?: boolean;
  onDictateNote?: () => void;
  onEditNote?: () => void;
};

export default function HabitCard({
  habit,
  config,
  hasTodayNote,
  onDictateNote,
  onEditNote,
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const { handleTimerPress, handleFinishTimer, handleResetToday } = useHabitTimerControls();
  const {
    todayTotal,
    isDone,
    streak,
    activeTimerSession,
    toggleHabit,
  } = useEventStore(
    useShallow((state) => ({
      todayTotal: state.dailyTotals[habit.id] ?? 0,
      isDone: state.habitDoneToday[habit.id] ?? false,
      streak: state.habitStreaks[habit.id] ?? 0,
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
      activeTimerSession={activeTimerSession}
      hasTodayNote={hasTodayNote}
      onDictateNote={onDictateNote}
      onEditNote={onEditNote}
      onToggle={() =>
        toggleHabit(habit.id, config).catch((error) => {
          Alert.alert(
            t('habitWidget.couldNotUpdateTitle'),
            error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          );
        })
      }
      onTimerPress={() => handleTimerPress(habit.id, config)}
      onTimerFinish={() =>
        // Manual Done marks play-once complete in meta, but must not play the goal chime
        // (chime is for live target-crossing or natural track end only).
        handleFinishTimer(habit.id, config, true).catch((error) => {
          Alert.alert(
            t('habitWidget.couldNotFinishTimerTitle'),
            error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          );
        })
      }
      onResetToday={() =>
        handleResetToday(habit.id, config).catch((error) => {
          Alert.alert(
            t('habitWidget.couldNotResetTodayTitle'),
            error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          );
        })
      }
      onOpenDetails={() => navigation.navigate('TrackerHistory', { elementId: habit.id })}
    />
  );
}
