import { useEffect, useState } from 'react';
import type {
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
  const [metricsFullscreen, setMetricsFullscreen] = useState(false);
  const [biSearchQuery, setBiSearchQuery] = useState('');
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

  return {
    biControls,
    biRankingSort,
    biSearchQuery,
    metricsFullscreen,
    selectedBiRankItem,
    setBiControls,
    setBiSearchQuery,
    setMetricsFullscreen,
    setSelectedBiRankItem,
    onBiRankingSort,
  };
}
