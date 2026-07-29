const { tenantMatches } = require('./access');

describe('Project access helpers', () => {
  describe('tenantMatches', () => {
    it('allows projects without tenant for legacy compatibility', () => {
      expect(tenantMatches({}, 'tenant-1')).toBe(true);
    });

    it('matches tenant ids by value instead of object identity', () => {
      const tenantId = {
        toString: () => 'tenant-1',
      };

      expect(tenantMatches({ tenantId }, 'tenant-1')).toBe(true);
    });

    it('rejects different tenant ids', () => {
      expect(tenantMatches({ tenantId: 'tenant-2' }, 'tenant-1')).toBe(false);
    });
  });
});
