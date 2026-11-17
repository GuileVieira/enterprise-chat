type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

interface MutationInput {
  action: string;
  entityId?: string;
  fields?: JsonObject;
}
interface MutationResult {
  entityLevel: string;
  entityId: string;
  deleted?: boolean;
  adId?: string;
  current?: JsonObject;
}
interface MutationContext {
  adAccountId: string;
  read: (id: string, fields: string) => Promise<JsonObject>;
  write: (path: string, body: JsonObject) => Promise<JsonObject>;
  remove: (id: string) => Promise<JsonObject | boolean>;
  assertOwnership: (id: string) => Promise<void>;
}

const creationFields = {
  campaign: [
    'name',
    'objective',
    'status',
    'special_ad_categories',
    'special_ad_category_country',
    'buying_type',
    'bid_strategy',
    'daily_budget',
    'lifetime_budget',
    'spend_cap',
    'is_adset_budget_sharing_enabled',
  ],
  adset: [
    'name',
    'campaign_id',
    'status',
    'daily_budget',
    'lifetime_budget',
    'bid_amount',
    'bid_strategy',
    'billing_event',
    'optimization_goal',
    'targeting',
    'start_time',
    'end_time',
    'promoted_object',
    'destination_type',
    'attribution_spec',
    'pacing_type',
    'dsa_beneficiary',
    'dsa_payor',
    'optimization_sub_event',
  ],
  ad: ['name', 'adset_id', 'creative', 'status', 'tracking_specs', 'conversion_domain'],
  creative: [
    'name',
    'object_story_spec',
    'object_story_id',
    'asset_feed_spec',
    'url_tags',
    'image_hash',
    'image_url',
    'video_id',
    'title',
    'body',
    'link_url',
    'object_url',
    'object_id',
    'call_to_action_type',
    'degrees_of_freedom_spec',
    'destination_set_id',
    'template_url',
    'template_url_spec',
    'product_set_id',
    'instagram_user_id',
  ],
};
type CreationLevel = keyof typeof creationFields;
const edges: { [level in CreationLevel]: string } = {
  campaign: 'campaigns',
  adset: 'adsets',
  ad: 'ads',
  creative: 'adcreatives',
};

function invalid(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 400 });
}
function object(value: JsonValue | undefined): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
function id(value: JsonValue | undefined): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    invalid('A numeric Meta entity id is required.');
  }
  return value;
}
function validateFields(level: CreationLevel, fields?: JsonObject): JsonObject {
  if (!object(fields) || !Object.keys(fields).length) {
    invalid('Meta Ads creation fields are required.');
  }
  if (JSON.stringify(fields).length > 100_000) {
    invalid('Meta Ads payload is too large.');
  }
  const unsupported = Object.keys(fields).filter((key) => !creationFields[level].includes(key));
  if (unsupported.length) {
    invalid(`Unsupported ${level} creation fields: ${unsupported.join(', ')}.`);
  }
  if (typeof fields.name !== 'string' || !fields.name.trim()) {
    invalid('name is required.');
  }
  if (level === 'campaign') {
    if (typeof fields.objective !== 'string' || !fields.objective) {
      invalid('objective is required.');
    }
    if (
      !Array.isArray(fields.special_ad_categories) ||
      !fields.special_ad_categories.every((category) => typeof category === 'string')
    ) {
      invalid('special_ad_categories must be an array. Use [] when none apply.');
    }
  }
  for (const key of ['daily_budget', 'lifetime_budget', 'bid_amount', 'spend_cap']) {
    const value = fields[key];
    if (
      value !== undefined &&
      !(
        (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
        (typeof value === 'string' && /^\d+$/.test(value))
      )
    ) {
      invalid(`${key} must be a non-negative integer in Meta minor currency units.`);
    }
  }
  if (level === 'adset') {
    id(fields.campaign_id);
    if (
      !object(fields.targeting) ||
      typeof fields.billing_event !== 'string' ||
      typeof fields.optimization_goal !== 'string'
    ) {
      invalid('targeting, billing_event and optimization_goal are required for an ad set.');
    }
  }
  if (level === 'ad') {
    id(fields.adset_id);
    if (
      !object(fields.creative) ||
      Object.keys(fields.creative).some((key) => key !== 'creative_id')
    ) {
      invalid('creative must contain only creative_id. Use create_creative first.');
    }
    id(fields.creative.creative_id);
  }
  if (
    level === 'creative' &&
    !object(fields.object_story_spec) &&
    typeof fields.object_story_id !== 'string' &&
    typeof fields.object_url !== 'string' &&
    !object(fields.asset_feed_spec)
  ) {
    invalid(
      'Creative content is required: object_story_spec, object_story_id, object_url or asset_feed_spec.',
    );
  }
  if (
    level !== 'creative' &&
    fields.status !== undefined &&
    fields.status !== 'ACTIVE' &&
    fields.status !== 'PAUSED'
  ) {
    invalid('status must be ACTIVE or PAUSED.');
  }
  return { ...fields, ...(level === 'creative' ? {} : { status: fields.status ?? 'PAUSED' }) };
}

async function checkReferences(level: CreationLevel, fields: JsonObject, ctx: MutationContext) {
  if (level === 'adset') {
    await ctx.assertOwnership(id(fields.campaign_id));
  }
  if (level === 'ad') {
    await ctx.assertOwnership(id(fields.adset_id));
    if (object(fields.creative)) {
      await ctx.assertOwnership(id(fields.creative.creative_id));
    }
  }
  if (object(fields.targeting)) {
    for (const key of ['custom_audiences', 'excluded_custom_audiences']) {
      const audiences = fields.targeting[key];
      if (audiences === undefined) {
        continue;
      }
      if (!Array.isArray(audiences)) {
        invalid(`${key} must be an array.`);
      }
      for (const audience of audiences) {
        if (!object(audience)) {
          invalid(`${key} entries must contain an id.`);
        }
        await ctx.assertOwnership(id(audience.id));
      }
    }
  }
}

export async function executeMetaAdsMutation(
  input: MutationInput,
  ctx: MutationContext,
): Promise<MutationResult> {
  if (!/^act_\d+$/.test(ctx.adAccountId)) {
    invalid('Meta Ads ad account is not configured.');
  }
  if (input.action === 'delete_custom_audience') {
    const entityId = id(input.entityId);
    await ctx.assertOwnership(entityId);
    const audience = await ctx.read(entityId, 'id,subtype');
    if (audience.id !== entityId || typeof audience.subtype !== 'string' || !audience.subtype) {
      invalid('The entity is not a custom audience.');
    }
    const result = await ctx.remove(entityId);
    if (result !== true && (!object(result) || result.success !== true)) {
      throw Object.assign(new Error('Meta Ads did not confirm custom audience deletion.'), {
        statusCode: 502,
      });
    }
    return { entityLevel: 'custom_audience', entityId, deleted: true };
  }
  const replacing = input.action === 'update_ad_creative';
  const level = replacing ? 'creative' : input.action.replace(/^create_/, '');
  if (
    !Object.prototype.hasOwnProperty.call(edges, level) ||
    (!replacing && input.action !== `create_${level}`)
  ) {
    invalid('Unsupported Meta Ads creation action.');
  }
  const creationLevel = level as CreationLevel;
  const fields = validateFields(creationLevel, input.fields);
  await checkReferences(creationLevel, fields, ctx);
  const adId = replacing ? id(input.entityId) : undefined;
  if (adId) {
    await ctx.assertOwnership(adId);
  }
  const result = await ctx.write(`${ctx.adAccountId}/${edges[creationLevel]}`, fields);
  if (typeof result.id !== 'string' || !/^\d+$/.test(result.id)) {
    throw Object.assign(new Error('Meta Ads did not return the created entity id.'), {
      statusCode: 502,
    });
  }
  const entityId = result.id;
  try {
    const current = await ctx.read(
      entityId,
      creationLevel === 'creative' ? 'id,account_id,name' : 'id,account_id,name,configured_status',
    );
    if (
      current.id !== entityId ||
      `act_${String(current.account_id).replace(/^act_/, '')}` !== ctx.adAccountId ||
      current.name !== fields.name ||
      (creationLevel !== 'creative' && current.configured_status !== fields.status)
    ) {
      throw new Error('Meta Ads creation readback did not match.');
    }
    if (adId) {
      const linked = await ctx.write(adId, { creative: { creative_id: entityId } });
      if (linked.success !== true) {
        throw new Error('Meta Ads did not confirm the creative link.');
      }
      const ad = await ctx.read(adId, 'id,creative');
      if (ad.id !== adId || !object(ad.creative) || ad.creative.id !== entityId) {
        throw new Error('Meta Ads creative link readback did not match.');
      }
    }
    return { entityLevel: creationLevel, entityId, ...(adId ? { adId } : {}), current };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Confirmation failed.';
    throw Object.assign(
      new Error(
        `Meta entity ${entityId} was created. ${detail} Do not recreate it; inspect this id first.`,
      ),
      {
        statusCode: 502,
        data: { entityId, ...(adId ? { adId } : {}) },
      },
    );
  }
}
