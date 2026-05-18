const { v4 } = require('uuid');
const { tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const { ContentTypes } = require('librechat-data-provider');
const {
  getBalanceConfig,
  getTransactionsConfig,
} = require('@librechat/api');
const openRouterGeminiToolkit =
  require('@librechat/api').openRouterGeminiToolkit || require('./openRouterGeminiToolkit');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { spendTokens, getFiles } = require('~/models');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_GEMINI_IMAGE_MODEL = 'google/gemini-3-pro-image-preview';

const displayMessage =
  "Premium Image Generator displayed an image. All generated images are already plainly visible, so don't repeat the descriptions in detail. Do not list download links as they are available in the UI already. The user may download the images by clicking on them, but do not mention anything about downloading to the user.";

function replaceUnwantedChars(inputString) {
  return (
    inputString
      ?.replace(/\r\n|\r|\n/g, ' ')
      .replace(/"/g, '')
      .trim() || ''
  );
}

function getOpenRouterKey(options = {}) {
  return options.OPENROUTER_KEY || process.env.OPENROUTER_KEY;
}

function estimatePromptTokens(prompt, imageCount = 0) {
  const text = typeof prompt === 'string' ? prompt : '';
  return Math.max(1, Math.ceil(text.length / 4) + imageCount * 85);
}

async function convertImagesToContent({ imageFiles, image_ids, req, fileStrategy }) {
  if (!image_ids || image_ids.length === 0) {
    return [];
  }

  const streamMethods = {};
  const requestFilesMap = Object.fromEntries(imageFiles.map((f) => [f.file_id, { ...f }]));
  const orderedFiles = new Array(image_ids.length);
  const idsToFetch = [];
  const indexOfMissing = Object.create(null);

  for (let i = 0; i < image_ids.length; i++) {
    const id = image_ids[i];
    const file = requestFilesMap[id];
    if (file) {
      orderedFiles[i] = file;
    } else {
      idsToFetch.push(id);
      indexOfMissing[id] = i;
    }
  }

  if (idsToFetch.length && req?.user?.id) {
    const fetchedFiles = await getFiles(
      {
        user: req.user.id,
        file_id: { $in: idsToFetch },
        height: { $exists: true },
        width: { $exists: true },
      },
      {},
      {},
    );

    for (const file of fetchedFiles) {
      requestFilesMap[file.file_id] = file;
      orderedFiles[indexOfMissing[file.file_id]] = file;
    }
  }

  const content = [];
  for (const imageFile of orderedFiles) {
    if (!imageFile) {
      continue;
    }

    try {
      const source = imageFile.source || fileStrategy;
      if (!source) {
        continue;
      }

      let getDownloadStream = streamMethods[source];
      if (!getDownloadStream) {
        ({ getDownloadStream } = getStrategyFunctions(source));
        streamMethods[source] = getDownloadStream;
      }
      if (!getDownloadStream) {
        continue;
      }

      const stream = await getDownloadStream(req, imageFile.filepath);
      if (!stream) {
        continue;
      }

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const base64Data = Buffer.concat(chunks).toString('base64');
      const mimeType = imageFile.type || 'image/png';

      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`,
        },
      });
    } catch (error) {
      logger.error('[OpenRouterGeminiImageGen] Error processing image:', imageFile.file_id, error);
    }
  }

  return content;
}

async function recordTokenUsage({
  usage,
  req,
  userId,
  messageId,
  prompt,
  imageCount,
  conversationId,
}) {
  const appConfig = req?.config;
  const balance = getBalanceConfig(appConfig);
  const transactions = getTransactionsConfig(appConfig);

  if (!balance?.enabled && transactions?.enabled === false) {
    return;
  }

  const promptTokens = usage?.prompt_tokens ?? estimatePromptTokens(prompt, imageCount);
  const completionTokens = usage?.completion_tokens ?? 0;

  if (promptTokens === 0 && completionTokens === 0) {
    logger.debug('[OpenRouterGeminiImageGen] No tokens to record');
    return;
  }

  try {
    await spendTokens(
      {
        user: userId,
        messageId,
        balance,
        transactions,
        conversationId,
        context: 'image_generation',
        model: OPENROUTER_GEMINI_IMAGE_MODEL,
      },
      {
        promptTokens,
        completionTokens,
      },
    );
  } catch (error) {
    logger.error('[OpenRouterGeminiImageGen] Error recording token usage:', error);
  }
}

function getImageUrl(response) {
  return response?.choices?.[0]?.message?.images?.find((image) => image?.image_url?.url)?.image_url
    ?.url;
}

function createOpenRouterGeminiImageTool(fields = {}) {
  const override = fields.override ?? false;

  if (!override && !fields.isAgent) {
    throw new Error('This tool is only available for agents.');
  }

  const { req, imageFiles = [], userId, fileStrategy } = fields;
  const apiKey = getOpenRouterKey(fields);

  const openRouterGeminiImageTool = tool(
    async ({ prompt, image_ids, aspectRatio, imageSize }, runnableConfig) => {
      if (!prompt) {
        throw new Error('Missing required field: prompt');
      }

      if (!apiKey) {
        return [
          [{ type: ContentTypes.TEXT, text: 'Missing OPENROUTER_KEY for image generation.' }],
          { content: [], file_ids: [] },
        ];
      }

      const sanitizedPrompt = replaceUnwantedChars(prompt);
      const content = [{ type: 'text', text: sanitizedPrompt }];
      const contextImages = await convertImagesToContent({
        imageFiles,
        image_ids,
        req,
        fileStrategy,
      });
      content.push(...contextImages);

      const body = {
        model: OPENROUTER_GEMINI_IMAGE_MODEL,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content }],
      };

      if (aspectRatio || imageSize) {
        body.image_config = {};
        if (aspectRatio) {
          body.image_config.aspect_ratio = aspectRatio;
        }
        if (imageSize) {
          body.image_config.image_size = imageSize;
        }
      }

      let response;
      try {
        response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: runnableConfig?.signal,
        });
      } catch (error) {
        logger.error('[OpenRouterGeminiImageGen] API error:', error);
        return [
          [{ type: ContentTypes.TEXT, text: `Image generation failed: ${error.message}` }],
          { content: [], file_ids: [] },
        ];
      }

      let apiResponse;
      try {
        apiResponse = await response.json();
      } catch (error) {
        logger.error('[OpenRouterGeminiImageGen] Response parse error:', error);
        return [
          [
            {
              type: ContentTypes.TEXT,
              text: 'Image generation failed: invalid OpenRouter response.',
            },
          ],
          { content: [], file_ids: [] },
        ];
      }

      if (!response.ok) {
        const message = apiResponse?.error?.message || response.statusText || 'OpenRouter error';
        logger.error('[OpenRouterGeminiImageGen] API response error:', message);
        return [
          [{ type: ContentTypes.TEXT, text: `Image generation failed: ${message}` }],
          { content: [], file_ids: [] },
        ];
      }

      const imageUrl = getImageUrl(apiResponse);
      if (!imageUrl) {
        logger.warn('[OpenRouterGeminiImageGen] No image data in response');
        return [
          [{ type: ContentTypes.TEXT, text: 'No image was generated. Please try again.' }],
          { content: [], file_ids: [] },
        ];
      }

      const file_ids = [v4()];
      const artifact = {
        content: [
          {
            type: ContentTypes.IMAGE_URL,
            image_url: { url: imageUrl },
          },
        ],
        file_ids,
      };

      const textResponse = [
        {
          type: ContentTypes.TEXT,
          text:
            displayMessage +
            `\n\ngenerated_image_id: "${file_ids[0]}"` +
            (image_ids?.length > 0 ? `\nreferenced_image_ids: ["${image_ids.join('", "')}"]` : ''),
        },
      ];

      const conversationId = runnableConfig?.configurable?.thread_id;
      const messageId =
        runnableConfig?.configurable?.run_id ??
        runnableConfig?.configurable?.requestBody?.messageId;

      await recordTokenUsage({
        usage: apiResponse.usage,
        req,
        userId,
        messageId,
        conversationId,
        prompt: sanitizedPrompt,
        imageCount: contextImages.length,
      });

      return [textResponse, artifact];
    },
    {
      ...openRouterGeminiToolkit.openrouter_gemini_image_gen,
      responseFormat: 'content_and_artifact',
    },
  );

  return openRouterGeminiImageTool;
}

module.exports = createOpenRouterGeminiImageTool;
module.exports.createOpenRouterGeminiImageTool = createOpenRouterGeminiImageTool;
module.exports.estimatePromptTokens = estimatePromptTokens;
