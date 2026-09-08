const fs = require('fs');
const { withHumanization } = require('@librechat/api');

const API_URL = 'https://api.assemblyai.com';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getHeaders(contentType) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }
  return {
    authorization: apiKey,
    ...(contentType ? { 'content-type': contentType } : {}),
  };
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || body.message || `AssemblyAI request failed (${response.status})`);
  }
  return body;
}

async function submitAudio(filepath, { participants = [], multichannel = false } = {}) {
  const upload = await request(`${API_URL}/v2/upload`, {
    method: 'POST',
    headers: getHeaders('application/octet-stream'),
    body: fs.createReadStream(filepath),
    duplex: 'half',
  });
  const speakers = participants
    .map((participant) => participant?.name?.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((name) => ({ name }));
  return request(`${API_URL}/v2/transcript`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({
      audio_url: upload.upload_url,
      speech_models: ['universal-3-5-pro', 'universal-2'],
      language_detection: true,
      speaker_labels: true,
      ...(multichannel ? { multichannel: true } : {}),
      ...(speakers.length > 0
        ? {
            speech_understanding: {
              request: {
                speaker_identification: {
                  speaker_type: 'name',
                  speakers,
                  effort: 'medium',
                },
              },
            },
          }
        : {}),
    }),
  });
}

const getTranscript = (id) =>
  request(`${API_URL}/v2/transcript/${encodeURIComponent(id)}`, {
    headers: getHeaders(),
  });

async function deleteTranscript(id) {
  const response = await fetch(`${API_URL}/v2/transcript/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || body.message || `AssemblyAI request failed (${response.status})`);
  }
}

async function generateInsights(transcript) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY or OPENROUTER_KEY is not configured');
  }
  const content = transcript.utterances
    .map((item) => `Speaker ${item.speaker}: ${item.text}`)
    .join('\n');
  const result = await request(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.MEETING_INSIGHTS_MODEL || 'anthropic/claude-sonnet-5',
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: withHumanization(
            'Analise a transcrição em português. Responda somente JSON válido no formato ' +
              '{"summary":"string","decisions":["string"],"nextSteps":["string"],"tasks":["string"]}. ' +
              'Não invente itens; use arrays vazios quando ausentes.',
          ),
        },
        {
          role: 'user',
          content,
        },
      ],
    }),
  });
  const raw = result.choices?.[0]?.message?.content ?? '{}';
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  const parsed = JSON.parse(json);
  const strings = (value) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    decisions: strings(parsed.decisions),
    nextSteps: strings(parsed.nextSteps),
    tasks: strings(parsed.tasks),
  };
}

module.exports = { deleteTranscript, generateInsights, getTranscript, submitAudio };
