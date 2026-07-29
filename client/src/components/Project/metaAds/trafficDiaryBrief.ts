import type { ProjectTrafficDiaryEntry } from 'librechat-data-provider';

function formatDate(value?: string) {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
}

export function buildTrafficDiaryAnalysisBrief({
  entry,
  projectName,
}: {
  entry: ProjectTrafficDiaryEntry;
  projectName?: string;
}) {
  const isStrategistDiary = entry.kind === 'strategist';
  const author = entry.createdBy.name || (isStrategistDiary ? 'Estrategista' : 'Gestor de tráfego');
  const filledAnswers = entry.answers.filter((answer) => answer.answer.trim().length > 0);
  const pendingAnswers = entry.answers.length - filledAnswers.length;
  const answers =
    filledAnswers
      .map((answer) => {
        return [`### ${answer.question}`, '', answer.answer.trim()].join('\n');
      })
      .join('\n\n') || 'Nenhuma resposta preenchida.';

  return [
    isStrategistDiary ? '# Análise do diário da estrategista' : '# Análise do diário de tráfego',
    '',
    `**Cliente:** ${projectName || 'Projeto'}`,
    `**Dia:** ${formatDate(`${entry.date || entry.weekStart}T12:00:00`)}`,
    `**Registrado por:** ${author}${entry.createdAt ? ` · ${formatDate(entry.createdAt)}` : ''}`,
    ...(pendingAnswers > 0 ? [`**Respostas pendentes:** ${pendingAnswers}`] : []),
    '',
    '---',
    '',
    answers,
    '',
    '---',
    '',
    'Use este registro junto dos dados atuais de Meta Ads. Mostre métricas relevantes, riscos e próximos passos práticos.',
  ].join('\n');
}
