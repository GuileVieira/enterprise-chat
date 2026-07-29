import type { ProjectMetaAdsTrend, ProjectMetaAdsEvolutionDelta } from 'librechat-data-provider';
import { evolutionColors, EVOLUTION_SERIES_LIMIT } from './constants';
import {
  getDeltaEntityId,
  getEvolutionSeriesTotal,
  hasMeaningfulDelta,
  matchesBiSeriesFilters,
} from './evolution';
import { buildChartPath, getEvolutionMetricValue } from './formatters';
import type { MetaAdsBiControls } from './types';

type EvolutionStateInput = {
  trend: ProjectMetaAdsTrend | undefined;
  controls: MetaAdsBiControls;
};

const chartWidth = 480;
const chartHeight = 160;
const chartPadding = 18;
const chartBottom = chartHeight - chartPadding;

export function buildMetaAdsEvolutionState({ trend, controls }: EvolutionStateInput) {
  const campaignDeltas = trend?.campaignDeltas ?? [];
  const changesByDay = trend?.changesByDay ?? [];
  const totalBudgetChangeCount = changesByDay.reduce(
    (sum, point) => sum + Number(point.changeCount ?? 0),
    0,
  );
  const evolutionSeries = (trend?.series ?? [])
    .filter(
      (series) =>
        series.level === controls.level &&
        matchesBiSeriesFilters(series, controls.objective, controls.resultType),
    )
    .map((series) => ({
      ...series,
      points: [...series.points].sort((left, right) => left.date.localeCompare(right.date)),
      total: getEvolutionSeriesTotal(series, controls.metric),
    }))
    .filter((series) => Number.isFinite(series.total) && Math.abs(series.total) > 0)
    .sort((left, right) => Number(right.total) - Number(left.total))
    .slice(0, EVOLUTION_SERIES_LIMIT);
  const evolutionDates = Array.from(
    new Set(evolutionSeries.flatMap((series) => series.points.map((point) => point.date))),
  ).sort((left, right) => left.localeCompare(right));
  const maxEvolutionValue = Math.max(
    ...evolutionSeries.flatMap((series) =>
      series.points.map((point) => Number(getEvolutionMetricValue(point, controls.metric) ?? 0)),
    ),
    0,
  );
  const evolutionSeriesPaths = evolutionSeries.map((series, seriesIndex) => {
    const points = evolutionDates.map((date, index) => {
      const rawPoint = series.points.find((point) => point.date === date);
      const value = Number(
        getEvolutionMetricValue(rawPoint ?? series.points[0], controls.metric) ?? 0,
      );
      const x =
        chartPadding +
        (index / Math.max(evolutionDates.length - 1, 1)) * (chartWidth - chartPadding * 2);
      const y =
        chartBottom - (value / Math.max(maxEvolutionValue, 1)) * (chartHeight - chartPadding * 2);
      return { x, y, value, date, rawPoint };
    });
    return {
      series,
      color: evolutionColors[seriesIndex % evolutionColors.length],
      points,
      path: buildChartPath(points),
    };
  });
  const evolutionSeriesIds = new Set(evolutionSeries.map((series) => series.entityId));
  const evolutionDeltas =
    trend?.entityDeltas && trend.entityDeltas.length > 0
      ? trend.entityDeltas
      : (campaignDeltas as ProjectMetaAdsEvolutionDelta[]);
  const meaningfulDeltas = evolutionDeltas
    .filter((delta) => (delta.level ?? 'campaign') === controls.level)
    .filter(
      (delta) => evolutionSeriesIds.size === 0 || evolutionSeriesIds.has(getDeltaEntityId(delta)),
    )
    .filter(hasMeaningfulDelta);
  const bestEvolution = [...meaningfulDeltas]
    .sort((left, right) => {
      const resultDiff = Number(right.resultDelta ?? 0) - Number(left.resultDelta ?? 0);
      if (resultDiff !== 0) {
        return resultDiff;
      }
      return Number(left.cpaDelta ?? 0) - Number(right.cpaDelta ?? 0);
    })
    .slice(0, 3);
  const evolutionAlerts = meaningfulDeltas
    .filter(
      (delta) =>
        controls.level !== 'ad' &&
        (Number(delta.cpaDelta ?? 0) > 0 ||
          Number(delta.frequencyDelta ?? 0) > 0 ||
          Number(delta.latestChange?.deltaDailyBudget ?? 0) !== 0),
    )
    .slice(0, 4);

  return {
    evolutionDates,
    evolutionSeriesPaths,
    maxEvolutionValue,
    totalBudgetChangeCount,
    bestEvolution,
    evolutionAlerts,
    hasEvolutionSection: Boolean(trend),
  };
}
