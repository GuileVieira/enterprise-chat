import { buildTrafficDiaryAnalysisBrief } from './trafficDiaryBrief';

describe('buildTrafficDiaryAnalysisBrief', () => {
  it('shows a clean manager-facing diary without internal metadata', () => {
    const brief = buildTrafficDiaryAnalysisBrief({
      projectName: 'Teste prok',
      entry: {
        _id: 'internal-id',
        projectId: 'internal-project',
        userId: 'internal-user',
        date: '2026-07-13',
        weekStart: '2026-07-06',
        status: 'draft',
        answers: [
          { id: 'strategy', question: 'Estratégia', answer: 'Testar novo gancho.' },
          { id: 'changes', question: 'Alterações', answer: '' },
        ],
        createdBy: { id: 'internal-user', name: 'Guilherme', email: 'private@example.com' },
        events: [],
        createdAt: '2026-07-13T00:56:37.124Z',
      },
    });

    expect(brief).toContain('**Cliente:** Teste prok');
    expect(brief).toContain('**Registrado por:** Guilherme');
    expect(brief).toContain('### Estratégia');
    expect(brief).toContain('Testar novo gancho.');
    expect(brief).toContain('**Respostas pendentes:** 1');
    expect(brief).not.toContain('_Não preenchida_');
    expect(brief).not.toContain('internal-id');
    expect(brief).not.toContain('private@example.com');
  });
});
