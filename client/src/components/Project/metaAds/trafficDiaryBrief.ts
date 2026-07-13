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
  const answers = entry.answers
    .map((answer) => {
      const value = answer.answer.trim() || '_Não preenchida_';
      return [`### ${answer.question}`, '', value].join('\n');
    })
    .join('\n\n');

  return [
    '# Análise do diário de tráfego',
    '',
    `**Cliente:** ${projectName || 'Projeto'}`,
    `**Semana:** ${formatDate(`${entry.weekStart}T12:00:00`)}`,
    `**Registrado por:** ${author}${entry.createdAt ? ` · ${formatDate(entry.createdAt)}` : ''}`,
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
