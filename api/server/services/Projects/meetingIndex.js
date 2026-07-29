const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileContext, FileSources } = require('librechat-data-provider');
const { deleteVectors, uploadVectors } = require('~/server/services/Files/VectorDB/crud');

const getMeetingId = (meeting) => String(meeting?._id ?? meeting?.id ?? '');
const getMeetingFileId = (meeting) => `meeting:${getMeetingId(meeting)}`;
const speakerName = (meeting, speaker) =>
  meeting.speakerNames?.get?.(speaker) || meeting.speakerNames?.[speaker] || `Speaker ${speaker}`;

function formatMeetingIndexText(meeting, project) {
  const utterances = meeting.utterances
    .map(
      (utterance) =>
        `[${formatTime(utterance.start)}] ${speakerName(meeting, utterance.speaker)}: ${utterance.text}`,
    )
    .join('\n');
  const list = (items) =>
    items?.length ? items.map((item) => `- ${item}`).join('\n') : '- Nenhum.';

  return [
    `# Reunião: ${meeting.title}`,
    `Projeto: ${project.name || project.projectId}`,
    `Data: ${new Date(meeting.recordedAt).toISOString()}`,
    `Duração: ${formatTime(meeting.duration * 1000)}`,
    '',
    '## Resumo',
    meeting.insights.summary || 'Sem resumo.',
    '',
    '## Decisões',
    list(meeting.insights.decisions),
    '',
    '## Próximos passos',
    list(meeting.insights.nextSteps),
    '',
    '## Tarefas',
    list(meeting.insights.tasks),
    '',
    '## Transcrição',
    utterances || meeting.transcript,
  ].join('\n');
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function syncMeetingIndex({
  meeting,
  project,
  req,
  createFile,
  deleteVectorsFn = deleteVectors,
  uploadVectorsFn = uploadVectors,
}) {
  const file_id = getMeetingFileId(meeting);
  const text = formatMeetingIndexText(meeting, project);
  const filename = `reuniao-${new Date(meeting.recordedAt).toISOString().slice(0, 10)}.txt`;
  const filepath = path.join(os.tmpdir(), `${file_id.replace(':', '-')}.txt`);
  await fs.promises.writeFile(filepath, text, 'utf8');
  let embeddingResult;
  try {
    await deleteVectorsFn(req, { file_id, embedded: true });
    embeddingResult = await uploadVectorsFn({
      req,
      file: {
        path: filepath,
        size: Buffer.byteLength(text),
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
      user: meeting.userId,
      file_id,
      bytes: Buffer.byteLength(text),
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
        meeting: {
          meetingId: getMeetingId(meeting),
          projectId: project.projectId,
          recordedAt: meeting.recordedAt,
        },
      },
    },
    true,
  );
}

module.exports = { formatMeetingIndexText, getMeetingFileId, syncMeetingIndex };
