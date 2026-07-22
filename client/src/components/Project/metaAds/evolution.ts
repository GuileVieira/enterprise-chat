import type {
  ProjectMetaAdsTrendSeries,
  ProjectMetaAdsEvolutionDelta,
} from 'librechat-data-provider';
import type { EvolutionMetric } from './types';
import { getEvolutionMetricValue } from './formatters';

export function getEvolutionSeriesTotal(
  series: ProjectMetaAdsTrendSeries,
  metric: EvolutionMetric,
) {
  if (metric === 'cpa') {
    const lastPoint = [...series.points]
      .reverse()
      .find((point) => getEvolutionMetricValue(point, metric) != null);
    return getEvolutionMetricValue(lastPoint ?? series.points[0], metric) ?? 0;
  }
  return series.points.reduce(
    (sum, point) => sum + Number(getEvolutionMetricValue(point, metric) ?? 0),
    0,
  );
}

export function hasMeaningfulDelta(delta: ProjectMetaAdsEvolutionDelta) {
  return [
    delta.spendDelta,
    delta.resultDelta,
    delta.cpaDelta,
    delta.budgetDelta,
    delta.frequencyDelta,
  ].some((value) => {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) && Math.abs(numericValue) > 0.005;
  });
}

export function matchesBiSeriesFilters(
  series: ProjectMetaAdsTrendSeries,
  objectiveFilter: string,
  resultTypeFilter: string,
) {
  return (
    (objectiveFilter === 'all' || !series.objective || series.objective === objectiveFilter) &&
    (resultTypeFilter === 'all' || !series.resultType || series.resultType === resultTypeFilter)
  );
}

export function getDeltaEntityId(delta: ProjectMetaAdsEvolutionDelta) {
  return delta.entityId || delta.campaignId || '';
}

export function getDeltaEntityName(delta: ProjectMetaAdsEvolutionDelta) {
  return delta.entityName || delta.campaignName;
}
