import React from 'react';
import { useTranslation } from 'react-i18next';
import SegmentedControl from '../SegmentedControl';
import { HISTORY_RANGES, type HistoryRangeDays } from '../../utils/chartStats';

type Props = {
  value: HistoryRangeDays;
  onChange: (days: HistoryRangeDays) => void;
};

/** 7 / 30 / 90 days, the same control on Insights and on every history screen. */
export default function HistoryRangeControl({ value, onChange }: Props) {
  const { t } = useTranslation('insights');
  return (
    <SegmentedControl
      options={HISTORY_RANGES.map((n) => ({
        value: String(n),
        label: t('history.rangeOption', { count: n }),
      }))}
      value={String(value)}
      onChange={(next) => {
        const days = HISTORY_RANGES.find((n) => String(n) === next);
        if (days != null) onChange(days);
      }}
    />
  );
}
