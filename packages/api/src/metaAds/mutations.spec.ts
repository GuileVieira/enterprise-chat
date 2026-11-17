import { executeMetaAdsMutation } from './mutations';

type Context = Parameters<typeof executeMetaAdsMutation>[1];
type Fields = NonNullable<Parameters<typeof executeMetaAdsMutation>[0]['fields']>;

function context() {
  const ctx = {
    adAccountId: 'act_123',
    read: jest.fn<ReturnType<Context['read']>, Parameters<Context['read']>>(),
    write: jest.fn<ReturnType<Context['write']>, Parameters<Context['write']>>(),
    remove: jest.fn<ReturnType<Context['remove']>, Parameters<Context['remove']>>(),
    assertOwnership: jest.fn<
      ReturnType<Context['assertOwnership']>,
      Parameters<Context['assertOwnership']>
    >(),
  };
  ctx.write.mockResolvedValue({ id: '900' });
  ctx.read.mockResolvedValue({
    id: '900',
    account_id: '123',
    name: 'New',
    configured_status: 'PAUSED',
  });
  ctx.assertOwnership.mockResolvedValue();
  return ctx;
}

const creative: Fields = {
  name: 'New',
  object_story_spec: {
    page_id: '22',
    link_data: { link: 'https://example.com/destination', image_hash: 'hash' },
  },
};
const cases: [string, string, Fields, string[]][] = [
  [
    'create_campaign',
    'campaigns',
    { name: 'New', objective: 'OUTCOME_SALES', special_ad_categories: [] },
    [],
  ],
  [
    'create_adset',
    'adsets',
    {
      name: 'New',
      campaign_id: '10',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      targeting: { geo_locations: { countries: ['BR'] }, custom_audiences: [{ id: '33' }] },
      daily_budget: 5000,
    },
    ['10', '33'],
  ],
  [
    'create_ad',
    'ads',
    { name: 'New', adset_id: '11', creative: { creative_id: '12' } },
    ['11', '12'],
  ],
  ['create_creative', 'adcreatives', creative, []],
];

describe('Meta Ads creation and audience deletion', () => {
  it.each(cases)(
    '%s posts to the project account and confirms the result',
    async (action, edge, fields, references) => {
      const ctx = context();
      const result = await executeMetaAdsMutation({ action, fields }, ctx);
      expect(ctx.write).toHaveBeenCalledWith(`act_123/${edge}`, {
        ...fields,
        ...(edge === 'adcreatives' ? {} : { status: 'PAUSED' }),
      });
      expect(ctx.assertOwnership.mock.calls.map(([entityId]) => entityId)).toEqual(references);
      expect(result.entityId).toBe('900');
    },
  );

  it('preserves explicitly requested ACTIVE status and minor currency units', async () => {
    const ctx = context();
    ctx.read.mockResolvedValue({
      id: '900',
      account_id: '123',
      name: 'New',
      configured_status: 'ACTIVE',
    });
    await executeMetaAdsMutation(
      {
        action: 'create_campaign',
        fields: {
          name: 'New',
          objective: 'OUTCOME_SALES',
          special_ad_categories: [],
          status: 'ACTIVE',
          daily_budget: 5000,
        },
      },
      ctx,
    );
    expect(ctx.write).toHaveBeenCalledWith(
      'act_123/campaigns',
      expect.objectContaining({ status: 'ACTIVE', daily_budget: 5000 }),
    );
  });

  it('creates a destination-bearing replacement then links and reads back the ad', async () => {
    const ctx = context();
    ctx.write.mockResolvedValueOnce({ id: '900' }).mockResolvedValueOnce({ success: true });
    ctx.read
      .mockResolvedValueOnce({ id: '900', account_id: '123', name: 'New' })
      .mockResolvedValueOnce({ id: '55', creative: { id: '900' } });
    const result = await executeMetaAdsMutation(
      { action: 'update_ad_creative', entityId: '55', fields: creative },
      ctx,
    );
    expect(ctx.assertOwnership).toHaveBeenCalledWith('55');
    expect(ctx.write.mock.calls).toEqual([
      ['act_123/adcreatives', creative],
      ['55', { creative: { creative_id: '900' } }],
    ]);
    expect(result).toEqual(expect.objectContaining({ entityId: '900', adId: '55' }));
  });

  it('reports the created id when linking fails, so retry does not silently create duplicates', async () => {
    const ctx = context();
    ctx.write.mockResolvedValueOnce({ id: '900' }).mockResolvedValueOnce({ success: false });
    await expect(
      executeMetaAdsMutation(
        { action: 'update_ad_creative', entityId: '55', fields: creative },
        ctx,
      ),
    ).rejects.toThrow('Meta entity 900 was created.');
  });

  it.each([true, { success: true }])(
    'accepts confirmed audience deletion: %p',
    async (response) => {
      const ctx = context();
      ctx.remove.mockResolvedValue(response);
      ctx.read.mockResolvedValue({ id: '33', subtype: 'WEBSITE' });
      await expect(
        executeMetaAdsMutation({ action: 'delete_custom_audience', entityId: '33' }, ctx),
      ).resolves.toEqual({ entityLevel: 'custom_audience', entityId: '33', deleted: true });
      expect(ctx.assertOwnership).toHaveBeenCalledWith('33');
      expect(ctx.remove).toHaveBeenCalledWith('33');
    },
  );

  it('cannot use audience deletion to delete a different Meta entity type', async () => {
    const ctx = context();
    ctx.read.mockResolvedValue({ id: '33', account_id: '123' });
    await expect(
      executeMetaAdsMutation({ action: 'delete_custom_audience', entityId: '33' }, ctx),
    ).rejects.toThrow('not a custom audience');
    expect(ctx.remove).not.toHaveBeenCalled();
  });

  it('rejects unconfirmed deletion', async () => {
    const ctx = context();
    ctx.remove.mockResolvedValue({ success: false });
    ctx.read.mockResolvedValue({ id: '33', subtype: 'WEBSITE' });
    await expect(
      executeMetaAdsMutation({ action: 'delete_custom_audience', entityId: '33' }, ctx),
    ).rejects.toThrow('did not confirm');
  });

  it.each(['create_ad', 'create_adset', 'update_ad_creative', 'delete_custom_audience'])(
    'blocks %s when any referenced entity is foreign',
    async (action) => {
      const ctx = context();
      ctx.assertOwnership.mockRejectedValue(new Error('Foreign account'));
      const fields = cases.find(([candidate]) => candidate === action)?.[2] ?? creative;
      await expect(executeMetaAdsMutation({ action, entityId: '55', fields }, ctx)).rejects.toThrow(
        'Foreign account',
      );
      expect(ctx.write).not.toHaveBeenCalled();
      expect(ctx.remove).not.toHaveBeenCalled();
    },
  );

  it.each([
    { action: 'create_creative', fields: { ...creative, access_token: 'override' } },
    { action: 'create_campaign', fields: { name: 'New', objective: 'OUTCOME_SALES' } },
    {
      action: 'create_campaign',
      fields: {
        name: 'New',
        objective: 'OUTCOME_SALES',
        special_ad_categories: [],
        daily_budget: 5.5,
      },
    },
    {
      action: 'create_ad',
      fields: { name: 'New', adset_id: '11', creative: { object_story_spec: {} } },
    },
    { action: 'create_creative', fields: { name: 'New' } },
    { action: 'delete_custom_audience', entityId: '33/users' },
    { action: 'create_constructor', fields: creative },
  ])('rejects invalid payload before writes: %p', async (input) => {
    const ctx = context();
    await expect(executeMetaAdsMutation(input, ctx)).rejects.toThrow();
    expect(ctx.write).not.toHaveBeenCalled();
    expect(ctx.remove).not.toHaveBeenCalled();
  });

  it.each([
    { id: '901', account_id: '123', name: 'New' },
    { id: '900', account_id: '999', name: 'New' },
    { id: '900', account_id: '123', name: 'Other' },
  ])('does not claim creation confirmation for mismatched readback', async (readback) => {
    const ctx = context();
    ctx.read.mockResolvedValue(readback);
    await expect(
      executeMetaAdsMutation({ action: 'create_creative', fields: creative }, ctx),
    ).rejects.toThrow('Meta entity 900 was created.');
  });
});
