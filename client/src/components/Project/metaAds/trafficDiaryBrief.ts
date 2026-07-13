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
  const author = entry.createdBy.name || 'Gestor de tráfego';
  const filledAnswers = entry.answers.filter((answer) => answer.answer.trim().length > 0);
  const pendingAnswers = entry.answers.length - filledAnswers.length;
  const answers =
    filledAnswers
      .map((answer) => {
        return [`### ${answer.question}`, '', answer.answer.trim()].join('\n');
      })
      .join('\n\n') || 'Nenhuma resposta preenchida.';

  return [
    '# Análise do diário de tráfego',
    '',
    `**Cliente:** ${projectName || 'Projeto'}`,
    `**Semana:** ${formatDate(`${entry.weekStart}T12:00:00`)}`,
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
