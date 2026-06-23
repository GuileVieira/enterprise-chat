import type { ComponentProps } from 'react';
import { MetaAdsBiControlsPanel } from './biControls';
import { MetaAdsBiRankingCard } from './biRankingCard';
import { MetaAdsEvolutionDashboard } from './evolutionDashboard';
import type { Localize, MetaAdsBiControls } from './types';

type MetaAdsBiWorkspaceProps = {
  controls: MetaAdsBiControls;
  period: Pick<
    ComponentProps<typeof MetaAdsBiControlsPanel>,
    | 'periodFilter'
    | 'customSince'
    | 'customUntil'
    | 'appliedCustomSince'
    | 'appliedCustomUntil'
    | 'onPeriodFilterChange'
    | 'onCustomSinceChange'
    | 'onCustomUntilChange'
    | 'onApplyCustomPeriod'
  >;
  search: {
    query: ComponentProps<typeof MetaAdsBiControlsPanel>['searchQuery'];
    onChange: ComponentProps<typeof MetaAdsBiControlsPanel>['onSearchQueryChange'];
  };
  options: Pick<
    ComponentProps<typeof MetaAdsBiControlsPanel>,
    'objectiveOptions' | 'resultTypeOptions'
  >;
  ranking: Pick<
    ComponentProps<typeof MetaAdsBiRankingCard>,
    'titleKey' | 'items' | 'testId' | 'sort' | 'fetching' | 'onSort' | 'onSelect'
  > & {
    adRankingEmptyMessageKey: ComponentProps<typeof MetaAdsBiRankingCard>['emptyMessageKey'];
  };
  evolution: Pick<
    ComponentProps<typeof MetaAdsEvolutionDashboard>,
    | 'seriesPaths'
    | 'dates'
    | 'maxValue'
    | 'totalBudgetChangeCount'
    | 'bestEvolution'
    | 'evolutionAlerts'
    | 'cleanName'
  > & {
    enabled: boolean;
  };
  inputClassName: string;
  currency: string;
  localize: Localize;
  onControlsChange: {
    level: ComponentProps<typeof MetaAdsBiControlsPanel>['onLevelChange'];
    objective: ComponentProps<typeof MetaAdsBiControlsPanel>['onObjectiveChange'];
    resultType: ComponentProps<typeof MetaAdsBiControlsPanel>['onResultTypeChange'];
    metric: ComponentProps<typeof MetaAdsBiControlsPanel>['onMetricChange'];
  };
};

export function MetaAdsBiWorkspace({
  controls,
  period,
  search,
  options,
  ranking,
  evolution,
  inputClassName,
  currency,
  localize,
  onControlsChange,
}: MetaAdsBiWorkspaceProps) {
  return (
    <div
      id="meta-ads-bi-tab-panel"
      role="tabpanel"
      aria-labelledby="meta-ads-tab-bi"
      data-testid="meta-ads-bi-tab-panel"
    >
      <div className="p-4">
        <MetaAdsBiControlsPanel
          controls={controls}
          searchQuery={search.query}
          periodFilter={period.periodFilter}
          customSince={period.customSince}
          customUntil={period.customUntil}
          appliedCustomSince={period.appliedCustomSince}
          appliedCustomUntil={period.appliedCustomUntil}
          objectiveOptions={options.objectiveOptions}
          resultTypeOptions={options.resultTypeOptions}
          inputClassName={inputClassName}
          localize={localize}
          onPeriodFilterChange={period.onPeriodFilterChange}
          onSearchQueryChange={search.onChange}
          onCustomSinceChange={period.onCustomSinceChange}
          onCustomUntilChange={period.onCustomUntilChange}
          onApplyCustomPeriod={period.onApplyCustomPeriod}
          onLevelChange={onControlsChange.level}
          onObjectiveChange={onControlsChange.objective}
          onResultTypeChange={onControlsChange.resultType}
          onMetricChange={onControlsChange.metric}
        />
        <MetaAdsBiRankingCard
          titleKey={ranking.titleKey}
          items={ranking.items}
          testId={ranking.testId}
          emptyMessageKey={
            controls.level === 'ad'
              ? ranking.adRankingEmptyMessageKey
              : 'com_ui_project_meta_ads_bi_no_rankings'
          }
          sort={ranking.sort}
          fetching={ranking.fetching}
          currency={currency}
          localize={localize}
          onSort={ranking.onSort}
          onSelect={ranking.onSelect}
        />
      </div>

      {evolution.enabled && (
        <MetaAdsEvolutionDashboard
          level={controls.level}
          metric={controls.metric}
          seriesPaths={evolution.seriesPaths}
          dates={evolution.dates}
          maxValue={evolution.maxValue}
          totalBudgetChangeCount={evolution.totalBudgetChangeCount}
          bestEvolution={evolution.bestEvolution}
          evolutionAlerts={evolution.evolutionAlerts}
          currency={currency}
          localize={localize}
          cleanName={evolution.cleanName}
        />
      )}
    </div>
  );
}
