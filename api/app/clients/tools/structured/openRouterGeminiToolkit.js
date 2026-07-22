const DEFAULT_OPENROUTER_GEMINI_IMAGE_GEN_DESCRIPTION = `Premium Image Generator creates high-quality images through OpenRouter using Nano Banana Pro (google/gemini-3-pro-image-preview), with optional image context. This tool costs 3x tokens.

When to use \`openrouter_gemini_image_gen\`:
- To create premium images with Nano Banana Pro from detailed text descriptions
- To generate or edit premium images using existing images as context
- When the user asks for premium image quality and accepts 3x token cost

When NOT to use \`openrouter_gemini_image_gen\`:
- For uploading or saving existing images without modification
- For low-cost/default image generation where premium quality is not needed

Generated image IDs will be returned in the response, so you can refer to them in future requests.`;

const DEFAULT_GEMINI_IMAGE_GEN_PROMPT_DESCRIPTION =
  'A detailed text description of the desired image, up to 32000 characters. For "editing" requests, describe the changes you want to make to the referenced image. Be specific about composition, style, lighting, and subject matter.';

const DEFAULT_GEMINI_IMAGE_IDS_DESCRIPTION = `
Optional array of image IDs to use as visual context for generation.

Guidelines:
- For "editing" requests: ALWAYS include the image ID being "edited"
- For new generation with context: Include any relevant reference image IDs
- If the user's request references any prior images, include their image IDs in this array
- These images will be used as visual context/inspiration for the new generation
- Never invent or hallucinate IDs; only use IDs that are visible in the conversation
- If no images are relevant, omit this field entirely
`.trim();

const geminiImageGenJsonSchema = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      maxLength: 32000,
      description:
        process.env.GEMINI_IMAGE_GEN_PROMPT_DESCRIPTION ||
        DEFAULT_GEMINI_IMAGE_GEN_PROMPT_DESCRIPTION,
    },
    image_ids: {
      type: 'array',
      items: { type: 'string' },
      description: process.env.GEMINI_IMAGE_IDS_DESCRIPTION || DEFAULT_GEMINI_IMAGE_IDS_DESCRIPTION,
    },
    aspectRatio: {
      type: 'string',
      enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      description:
        'The aspect ratio of the generated image. Use 16:9 or 3:2 for landscape, 9:16 or 2:3 for portrait, 21:9 for ultra-wide/cinematic, 1:1 for square. Defaults to 1:1 if not specified.',
    },
    imageSize: {
      type: 'string',
      enum: ['1K', '2K', '4K'],
      description:
        'The resolution of the generated image. Use 1K for standard, 2K for high, 4K for maximum quality. Defaults to 1K if not specified.',
    },
  },
  required: ['prompt'],
};

const openRouterGeminiToolkit = {
  openrouter_gemini_image_gen: {
    name: 'openrouter_gemini_image_gen',
    description:
      process.env.OPENROUTER_GEMINI_IMAGE_GEN_DESCRIPTION ||
      DEFAULT_OPENROUTER_GEMINI_IMAGE_GEN_DESCRIPTION,
    description_for_model: `Use this tool to generate premium images through OpenRouter using Nano Banana Pro (google/gemini-3-pro-image-preview). This tool costs 3x tokens.
1. Use it when premium image quality is explicitly requested or clearly valuable.
2. One image per function call. Create only 1 image per request.
3. For editing requests, ALWAYS include the original image ID in the image_ids array and use the user's editing instruction directly.
4. Use image_ids for context images that should influence the generation.
5. DO NOT list or refer to descriptions before OR after generating images.
6. Always mention the image type (photo, oil painting, watercolor painting, illustration, cartoon, drawing, vector, render, etc.) at the beginning of the prompt.
7. Use aspectRatio to control the shape of the image.
8. Use imageSize to control resolution: 1K, 2K, or 4K.

The prompt should be a detailed paragraph describing every part of the image in concrete, objective detail.`,
    schema: geminiImageGenJsonSchema,
    responseFormat: 'content_and_artifact',
  },
};

module.exports = openRouterGeminiToolkit;
