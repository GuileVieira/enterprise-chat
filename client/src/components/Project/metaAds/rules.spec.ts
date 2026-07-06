import { defaultCreativeRules, defaultRules } from './rules';

describe('Meta Ads rule defaults', () => {
  it('starts cooldown fields at one hour', () => {
    expect(defaultRules.cooldownHours).toBe(1);
    expect(defaultCreativeRules.pauseHighCost.cooldownHours).toBe(1);
  });
});
