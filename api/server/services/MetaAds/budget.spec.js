const { DEFAULT_RULES, proposeBudget } = require('./budget');

describe('Meta Ads budget service', () => {
  it('holds when spend is below the minimum sample', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 10,
      roas: 5,
      spend: 1,
      rules: DEFAULT_RULES,
    });

    expect(result.action).toBe('hold');
    expect(result.proposedDailyBudget).toBe(100);
  });

  it('increases budget when CPA and ROAS are healthy', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 20,
      roas: 3,
      spend: 200,
      rules: DEFAULT_RULES,
    });

    expect(result.action).toBe('increase');
    expect(result.proposedDailyBudget).toBe(115);
  });

  it('decreases budget when performance is below rule', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 80,
      roas: 1,
      spend: 200,
      rules: DEFAULT_RULES,
    });

    expect(result.action).toBe('decrease');
    expect(result.proposedDailyBudget).toBe(80);
  });
});
