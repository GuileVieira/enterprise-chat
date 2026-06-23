import { useEffect, useState } from 'react';
import { toDateInputValue, getDateInputDaysAgo } from '../settings';
import type {
  PeriodFilter,
  BiRankingSort,
  MetaAdsBiRankItem,
  MetaAdsBiControls,
  BiRankingSortKey,
} from '../types';

export function useMetaAdsBiWorkspace() {
  const [biControls, setBiControls] = useState<MetaAdsBiControls>({
    level: 'campaign',
    objective: 'all',
    resultType: 'all',
    metric: 'spend',
  });
  const [biRankingSort, setBiRankingSort] = useState<BiRankingSort>({
    key: 'cpa',
    direction: 'asc',
  });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('last_7d');
  const [customSince, setCustomSince] = useState(() => getDateInputDaysAgo(6));
  const [customUntil, setCustomUntil] = useState(() => toDateInputValue(new Date()));
  const [appliedCustomSince, setAppliedCustomSince] = useState(() => getDateInputDaysAgo(6));
  const [appliedCustomUntil, setAppliedCustomUntil] = useState(() => toDateInputValue(new Date()));
  const [metricsFullscreen, setMetricsFullscreen] = useState(false);
  const [selectedBiRankItem, setSelectedBiRankItem] = useState<MetaAdsBiRankItem | null>(null);

  useEffect(() => {
    if (!metricsFullscreen) {
      return;
    }
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMetricsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [metricsFullscreen]);

  const onBiRankingSort = (key: BiRankingSortKey) => {
    setBiRankingSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: key === 'cpa' ? 'asc' : 'desc' };
    });
  };

  const onCustomSinceChange = (value: string) => {
    setCustomSince(value);
    if (value && customUntil && value > customUntil) {
      setCustomUntil(value);
    }
  };

  const onCustomUntilChange = (value: string) => {
    setCustomUntil(value);
    if (value && customSince && value < customSince) {
      setCustomSince(value);
    }
  };

  const onApplyCustomPeriod = () => {
    setAppliedCustomSince(customSince);
    setAppliedCustomUntil(customUntil);
  };

  return {
    biControls,
    biRankingSort,
    periodFilter,
    customSince,
    customUntil,
    appliedCustomSince,
    appliedCustomUntil,
    metricsFullscreen,
    selectedBiRankItem,
    setBiControls,
    setPeriodFilter,
    setMetricsFullscreen,
    setSelectedBiRankItem,
    onBiRankingSort,
    onCustomSinceChange,
    onCustomUntilChange,
    onApplyCustomPeriod,
  };
}
