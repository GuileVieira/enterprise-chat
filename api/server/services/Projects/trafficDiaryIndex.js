const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileContext, FileSources } = require('librechat-data-provider');
const { deleteVectors, uploadVectors } = require('~/server/services/Files/VectorDB/crud');

function getEntryId(entry) {
  return String(entry?._id ?? entry?.id ?? '');
}

function getDiaryIndexFileId(entry) {
  const entryId = getEntryId(entry);
  const kind = entry?.kind === 'strategist' ? 'strategist' : 'manager';
  return entryId ? `traffic-diary:${kind}:${entryId}` : '';
}

function getActorLabel(actor) {
  return actor?.name || actor?.email || actor?.id || 'desconhecido';
}

function getCampaignLines(answers = []) {
  return answers
    .filter((answer) =>
      /campanh|campaign|ad set|conjunto|an[uú]ncio|creative|criativo/i.test(
        `${answer.id ?? ''} ${answer.question ?? ''} ${answer.answer ?? ''}`,
      ),
    )
    .map((answer) => answer.answer?.trim())
    .filter(Boolean);
}

function formatTrafficDiaryIndexText({ entry, project }) {
  const kind = entry.kind === 'strategist' ? 'strategist' : 'manager';
  const title = kind === 'strategist' ? 'Diário da estrategista' : 'Diário do gestor de tráfego';
  const updatedAt = entry.updatedAt ? new Date(entry.updatedAt).toISOString() : '';
  const date = entry.completedAt || entry.updatedAt || entry.createdAt;
  const recordDate =
    entry.date || (date ? new Date(date).toISOString().slice(0, 10) : entry.weekStart);
  const author = entry.lastEditedBy || entry.completedBy || entry.createdBy;
  const campaigns = getCampaignLines(entry.answers);
  const answers = (entry.answers ?? [])
    .filter((answer) => answer.answer?.trim())
    .map((answer) => `- ${answer.question}: ${answer.answer.trim()}`)
    .join('\n');

  return [
    `# ${title}`,
    `Projeto: ${project.projectId}`,
    `Cliente: ${project.name || project.projectId}`,
    `Data: ${recordDate}`,
    `Semana: ${entry.weekStart || entry.date}`,
    `Autor: ${getActorLabel(author)}`,
    `Campanhas relacionadas: ${campaigns.length ? campaigns.join(' | ') : 'não informado'}`,
    `Tipo de diário: ${kind === 'strategist' ? 'estrategista' : 'gestor de tráfego'}`,
    `Tipo de registro: ${entry.status === 'completed' ? 'fechamento semanal' : 'registro diário'}`,
    `Data da última atualização: ${updatedAt || 'não informado'}`,
    '',
    '## Respostas',
    answers || '- Sem respostas preenchidas.',
  ].join('\n');
}

async function syncTrafficDiaryIndex({
  entry,
  project,
  req,
  userId,
  createFile,
  deleteVectorsFn = deleteVectors,
  uploadVectorsFn = uploadVectors,
}) {
  const file_id = getDiaryIndexFileId(entry);
  if (!file_id) {
    return null;
  }
  const text = formatTrafficDiaryIndexText({ entry, project });
  const kind = entry?.kind === 'strategist' ? 'estrategista' : 'gestor';
  const filename = `diario-${kind}-${entry.date || entry.weekStart}.txt`;
  const filepath = path.join(os.tmpdir(), `${file_id.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`);
  await fs.promises.writeFile(filepath, text, 'utf8');
  let embeddingResult;
  try {
    await deleteVectorsFn(req ?? { user: { id: userId } }, { file_id, embedded: true });
    embeddingResult = await uploadVectorsFn({
      req: req ?? { user: { id: userId } },
      file: {
        path: filepath,
        size: Buffer.byteLength(text, 'utf8'),
        originalname: filename,
        mimetype: 'text/plain',
      },
      file_id,
      entity_id: project.projectId,
    });
  } finally {
    await fs.promises.rm(filepath, { force: true });
  }

  return createFile(
    {
      user: userId,
      file_id,
      bytes: Buffer.byteLength(text, 'utf8'),
      filename,
      filepath: embeddingResult?.filepath ?? FileSources.vectordb,
      object: 'file',
      embedded: Boolean(embeddingResult?.embedded),
      type: 'text/plain',
      text,
      textFormat: 'text',
      context: FileContext.agents,
      source: FileSources.text,
      usage: 0,
      projectId: project.projectId,
      tenantId: project.tenantId,
      metadata: {
        trafficDiary: {
          entryId: getEntryId(entry),
          kind: entry.kind || 'manager',
          projectId: project.projectId,
          tenantId: project.tenantId,
          userId: entry.userId,
          date: entry.date,
          weekStart: entry.weekStart || entry.date,
          status: entry.status,
          updatedAt: entry.updatedAt,
        },
      },
    },
    true,
  );
}

async function deleteTrafficDiaryIndex({
  entry,
  req,
  deleteFiles,
  deleteVectorsFn = deleteVectors,
}) {
  const file_id = getDiaryIndexFileId(entry);
  if (!file_id) {
    return null;
  }
  await deleteVectorsFn(req, { file_id, embedded: true });
  return deleteFiles([file_id]);
}

module.exports = {
  deleteTrafficDiaryIndex,
  formatTrafficDiaryIndexText,
  getDiaryIndexFileId,
  syncTrafficDiaryIndex,
};
