# Meta Ads Campaign View Plan

Source transcript: `docs/Guilherme Vieira-Marcelo Kuwer-04-06-2026 (1).csv`

## Summary

Meta Ads tab must move from isolated ad set rows to an operator view closer to Meta Ads Manager:
active campaigns first, expandable ad sets, key performance metrics, campaign/ad set selection for
traffic-agent chat, and rule overrides for special campaign/ad set cases.

The first implementation keeps the current recommendation/apply flow at ad set budget level, while
adding campaign grouping and rule override foundations. Campaign-level budget application, account
daily spend alerts, period dashboard, and creative diagnostics remain follow-up PRs.

## Epic 1: Campaign and Ad Set Data

### PR 1: Meta Graph campaign hierarchy

- Fetch active campaigns with `id`, `name`, `objective`, `daily_budget`, and `effective_status`.
- Fetch active ad sets with `campaign_id` and parent campaign name.
- Fetch ad set insights with campaign fields plus core delivery metrics.
- Persist campaign fields in `MetaAdsSnapshot`.

Status: implemented.

### PR 2: Hierarchical status payload

- Keep existing `latestSnapshots`, `recommendations`, and `changes`.
- Add optional `campaigns[]` to `GET /api/projects/:projectId/meta-ads`.
- Group snapshots into campaign summaries with nested `adSets[]`.
- Preserve fallback behavior for old snapshots without campaign data.

Status: implemented.

## Epic 2: Rule Overrides

### PR 3: Project schema for campaign/ad set overrides

- Add `metaAds.ruleOverrides[]`.
- Supported override levels: `campaign`, `adset`.
- Store `entityId`, optional `entityName`, `enabled`, and validated `rules`.
- Add fields to Zod schema, Mongoose schema, and TS project type.

Status: implemented.

### PR 4: Effective rule resolution

- Resolve rules in this order:
  - ad set override
  - campaign override
  - project global rule
- Use effective rule during analysis before creating recommendation.

Status: implemented.

## Epic 3: Campaign-First UI

### PR 5: Campaign table

- Replace latest ad set table with campaign/ad set table.
- Show active campaign rows first.
- Campaign rows display:
  - objective
  - result count
  - cost per result
  - daily budget
  - spend
  - frequency
  - CTR
- Campaign rows can expand to reveal ad sets.
- Old snapshot-only data renders through fallback grouping.

Status: implemented.

### PR 6: Rule editor UI

- Add row-level drawer/modal to edit campaign/ad set override.
- Show whether row uses global, campaign, or ad set rule.
- Allow reverting row to global rule.

Status: backlog.

## Epic 4: Traffic Agent Context

### PR 7: Campaign-aware chat brief

- Allow selected campaign IDs and ad set IDs.
- Include selected campaign hierarchy in `meta_ads_brief`.
- Keep old selected ad set behavior compatible.
- Update initial prompt wording from ad-set-only to campaigns/ad sets.

Status: implemented.

## Epic 5: Account Alerts and Dashboard

### PR 8: Account daily budget alert

- Add global Meta Ads account daily spend limit.
- Alert traffic manager when account is near or over threshold.
- Do not pause campaigns automatically.

Status: backlog.

### PR 9: Period dashboard

- Add period selector.
- Add high-level cards/charts:
  - total spend
  - average cost per result
  - best campaign by cost
  - worst campaign by cost
  - campaign with most messages/results
  - average frequency

Status: backlog.

### PR 10: Creative diagnostics

- Fetch ad/creative-level insights.
- Surface best creative by campaign.
- Flag stale single-creative dependency, low CTR, low video 75% view rate, and new creatives with
  no delivery.

Status: backlog.

## Verification

Implemented PRs verified with:

- `cd api && npm run test:ci -- MetaAds`
- `cd client && npm run test:ci -- ProjectMetaAdsPanel metaAdsChatBrief`
- `npx tsc --noEmit -p packages/data-provider/tsconfig.json`

Known broad typecheck blockers outside this change:

- `packages/data-schemas` fails on existing Mongoose `lean()` typing in ACL/category/group methods.
- `packages/api` fails on existing permission/tool spec typing.
- `client` full typecheck fails on existing unrelated TS issues across tests, chat, file config, and
  several utility areas.
