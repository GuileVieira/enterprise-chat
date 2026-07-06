import { defaultCreativeRules, defaultRules, numberFields } from './rules';

describe('Meta Ads rule defaults', () => {
  it('does not expose cooldown in rule defaults or numeric fields', () => {
    expect(defaultRules).not.toHaveProperty('cooldownHours');
    expect(defaultCreativeRules.pauseHighCost).not.toHaveProperty('cooldownHours');
    expect(numberFields.map((field) => field.key)).not.toContain('cooldownHours');
  });
});
