# Meta Ads Graph Permissions Checklist

Scope: paid Meta Ads reporting for Orqest projects. This checklist does not cover organic
Facebook Page or Instagram profile insights.

Last checked: 2026-07-06.

Official references:

- Meta Marketing API authorization: https://developers.facebook.com/docs/marketing-api/overview/authorization/
- Meta Ad Account Insights: https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/

## Minimum Access

- App has Marketing API product enabled.
- App has Marketing API Access Tier suitable for production client data.
- Client token has `ads_read` for read-only reports.
- Client token has `ads_management` only when Orqest must publish, pause, duplicate, or change budgets.
- Token owner or system user can access the target ad account.
- If the ad account is under Business Manager, the business asset grant includes the target ad account.

## Project Validation

For each project token, validate without logging or displaying the token:

- `GET /<AD_ACCOUNT_ID>/campaigns` returns campaign IDs, names, status, objective, and budget fields.
- `GET /<AD_ACCOUNT_ID>/adsets` returns ad set IDs, campaign IDs, names, status, and budget fields.
- `GET /<AD_ACCOUNT_ID>/ads` returns ad IDs, ad set IDs, campaign IDs, names, status, and creative fields.
- `GET /<AD_ACCOUNT_ID>/insights` works for `level=campaign`, `level=adset`, and `level=ad`.
- Insights include spend, impressions, clicks, CTR, actions, cost per action, and ROAS when Meta has data.
- Date presets and custom `time_range` return the expected period.

## Failure Signals

- Error `190`: token missing, expired, revoked, or invalid.
- Error `200`: permission or asset access missing.
- Error `100`: invalid field, period, account, or parameter.
- Error `613`: rate limit; retry later and reduce duplicate calls.

## Orqest Acceptance

- Project token is used when configured; tenant token is fallback only.
- UI shows token source as project, tenant, or missing without exposing token value.
- BI report cards and ranking tables load from project-scoped Meta Ads endpoints.
- Report data matches Meta Ads for the same account, level, and period within normal attribution delay.
