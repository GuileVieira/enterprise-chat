const { DEFAULT_RULES } = require('./budget');

describe('Meta Ads defaults', () => {
  it('starts automation cooldown at one hour', () => {
    expect(DEFAULT_RULES.cooldownHours).toBe(1);
  });
});
