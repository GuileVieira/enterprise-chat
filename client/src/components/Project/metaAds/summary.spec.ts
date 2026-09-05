import { buildSummaryResultTypeOptions } from './summary';

describe('buildSummaryResultTypeOptions', () => {
  it('keeps named custom payment conversions in ecommerce summaries', () => {
    const options = buildSummaryResultTypeOptions(
      [
        {
          objective: 'OUTCOME_SALES',
          campaignCount: 1,
          totalSpend: 100,
          totalResults: null,
          averageCostPerResult: null,
          averageFrequency: null,
          averageCtr: null,
          resultTypes: [
            {
              resultType: 'offsite_conversion.custom.987',
              label: 'Boleto pago',
              totalSpend: 100,
              totalResults: 4,
              averageCostPerResult: 25,
            },
          ],
        },
      ],
      'all',
      true,
    );

    expect(options).toEqual([
      expect.objectContaining({
        resultType: 'offsite_conversion.custom.987',
        label: 'Boleto pago',
        totalResults: 4,
      }),
    ]);
  });
});
