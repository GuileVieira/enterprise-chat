const { DEFAULT_RULES, _resolveActionCooldownMinutesForTest } = require('./budget');

describe('Meta Ads defaults', () => {
  it('does not expose cooldown as a configurable rule default', () => {
    expect(DEFAULT_RULES).not.toHaveProperty('cooldownHours');
  });

  it('derives action cooldown from automation schedule and action floor', () => {
    expect(
      _resolveActionCooldownMinutesForTest({
        actionType: 'budget_change',
        scheduleIntervalMinutes: 30,
      }),
    ).toBe(60);
    expect(
      _resolveActionCooldownMinutesForTest({
        actionType: 'budget_change',
        scheduleIntervalMinutes: 180,
      }),
    ).toBe(180);
    expect(
      _resolveActionCooldownMinutesForTest({
        actionType: 'pause_ad',
        scheduleIntervalMinutes: 30,
      }),
    ).toBe(60);
  });
});
