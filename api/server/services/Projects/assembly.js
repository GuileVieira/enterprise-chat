const fs = require('fs');

const API_URL = 'https://api.assemblyai.com';
const LLM_URL = 'https://llm-gateway.assemblyai.com/v1/chat/completions';

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

async function submitAudio(filepath) {
  const upload = await request(`${API_URL}/v2/upload`, {
    method: 'POST',
    headers: getHeaders('application/octet-stream'),
    body: fs.createReadStream(filepath),
    duplex: 'half',
  });
  return request(`${API_URL}/v2/transcript`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({
      audio_url: upload.upload_url,
      speech_models: ['universal-3-5-pro', 'universal-2'],
      language_detection: true,
      speaker_labels: true,
    }),
  });
}

const getTranscript = (id) =>
  request(`${API_URL}/v2/transcript/${encodeURIComponent(id)}`, {
    headers: getHeaders(),
  });

async function generateInsights(transcript) {
  const content = transcript.utterances
    .map((item) => `Speaker ${item.speaker}: ${item.text}`)
    .join('\n');
  const result = await request(LLM_URL, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({
      model: process.env.ASSEMBLYAI_LLM_MODEL || 'claude-sonnet-5',
      max_tokens: 1800,
      messages: [
        {
          role: 'user',
          content:
            'Analise a transcrição em português. Responda somente JSON válido no formato ' +
            '{"summary":"string","decisions":["string"],"nextSteps":["string"],"tasks":["string"]}. ' +
            'Não invente itens; use arrays vazios quando ausentes.\n\n' +
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

module.exports = { generateInsights, getTranscript, submitAudio };
