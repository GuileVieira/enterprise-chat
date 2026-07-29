const DIMENSIONS = {
  campaign: ['campaign_id', 'campaign_name'],
  adset: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name'],
  ad: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name'],
  day: ['date_start'],
};

const ADDITIVE_METRICS = ['spend', 'impressions', 'reach', 'clicks'];
const DERIVED_METRICS = ['frequency', 'cpm', 'ctr', 'cpc'];
const DEFAULT_METRICS = [...ADDITIVE_METRICS, ...DERIVED_METRICS];
const METRICS = [...DEFAULT_METRICS, 'actions', 'action_values', 'purchase_roas'];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumTypedValues(target, values) {
  for (const item of Array.isArray(values) ? values : []) {
    if (typeof item?.action_type === 'string') {
      target[item.action_type] = (target[item.action_type] ?? 0) + number(item.value);
    }
  }
}

function createAggregate(row, dimensions) {
  return Object.fromEntries(dimensions.map((field) => [field, row[field]]));
}

function addRow(aggregate, row, metrics) {
  for (const metric of ADDITIVE_METRICS) {
    if (metrics.includes(metric)) {
      aggregate[metric] = number(aggregate[metric]) + number(row[metric]);
    }
  }
  for (const metric of ['actions', 'action_values']) {
    if (metrics.includes(metric)) {
      aggregate[metric] ??= {};
      sumTypedValues(aggregate[metric], row[metric]);
    }
  }
  if (metrics.includes('purchase_roas')) {
    const value = Array.isArray(row.purchase_roas)
      ? (row.purchase_roas.find((item) => item?.action_type === 'omni_purchase')?.value ??
        row.purchase_roas[0]?.value)
      : row.purchase_roas;
    aggregate.purchase_value = number(aggregate.purchase_value) + number(value) * number(row.spend);
  }
}

function finish(aggregate, metrics) {
  const spend = number(aggregate.spend);
  const impressions = number(aggregate.impressions);
  const reach = number(aggregate.reach);
  const clicks = number(aggregate.clicks);
  const result = { ...aggregate };

  if (metrics.includes('frequency')) result.frequency = reach ? impressions / reach : 0;
  if (metrics.includes('cpm')) result.cpm = impressions ? (spend / impressions) * 1000 : 0;
  if (metrics.includes('ctr')) result.ctr = impressions ? (clicks / impressions) * 100 : 0;
  if (metrics.includes('cpc')) result.cpc = clicks ? spend / clicks : 0;
  if (metrics.includes('purchase_roas')) {
    result.purchase_roas = spend ? number(result.purchase_value) / spend : 0;
    delete result.purchase_value;
  }
  return result;
}

function keyFor(row, dimensions) {
  return dimensions.map((field) => row[field] ?? '').join('\u0000');
}

function createInsightsSummary({ level, metrics, sortBy, sortOrder, detailLimit, byDay }) {
  const tableNames = ['campaign'];
  if (level !== 'campaign') tableNames.push('adset');
  if (level === 'ad') tableNames.push('ad');
  if (byDay) tableNames.push('day');
  const maps = Object.fromEntries(tableNames.map((name) => [name, new Map()]));
  const totals = {};
  let processedRows = 0;

  return {
    add(rows) {
      for (const row of rows) {
        processedRows += 1;
        addRow(totals, row, metrics);
        for (const name of tableNames) {
          const dimensions = DIMENSIONS[name];
          const key = keyFor(row, dimensions);
          const aggregate = maps[name].get(key) ?? createAggregate(row, dimensions);
          addRow(aggregate, row, metrics);
          maps[name].set(key, aggregate);
        }
      }
    },
    build() {
      const tables = {};
      const available = {};
      const omitted = {};
      for (const name of tableNames) {
        const rows = [...maps[name].values()]
          .map((row) => finish(row, metrics))
          .sort((left, right) => {
            const difference = number(left[sortBy]) - number(right[sortBy]);
            return sortOrder === 'asc' ? difference : -difference;
          });
        available[name] = rows.length;
        tables[name] = rows.slice(0, detailLimit);
        omitted[name] = Math.max(0, rows.length - detailLimit);
      }
      return {
        processedRows,
        totals: finish(totals, metrics),
        tables,
        available,
        omitted,
        hasMoreDetails: Object.values(omitted).some((count) => count > 0),
      };
    },
  };
}

module.exports = {
  DEFAULT_METRICS,
  METRICS,
  createInsightsSummary,
};
