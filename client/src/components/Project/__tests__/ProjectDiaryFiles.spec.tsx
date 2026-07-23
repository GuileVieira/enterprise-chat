import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ProjectTrafficDiaryEntry } from 'librechat-data-provider';
import ProjectDiaryFiles from '../ProjectDiaryFiles';

const mockReprocess = jest.fn();
const mockEntry: ProjectTrafficDiaryEntry = {
  _id: 'entry-1',
  projectId: 'project-1',
  userId: 'user-1',
  kind: 'manager',
  date: '2026-07-23',
  weekStart: '2026-07-23',
  status: 'draft',
  indexStatus: 'failed',
  answers: [{ id: 'result', question: 'Resultado', answer: 'CPA caiu.' }],
  createdBy: { id: 'user-1', name: 'Ana' },
  events: [],
};

jest.mock('~/data-provider', () => ({
  useProjectMetaAdsDiaryQuery: jest.fn((_projectId: string, kind: string) => ({
    data: { entries: kind === 'manager' ? [mockEntry] : [] },
    isLoading: false,
  })),
  useReprocessProjectMetaAdsDiaryMutation: jest.fn(() => ({
    mutate: mockReprocess,
    isLoading: false,
  })),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('ProjectDiaryFiles', () => {
  it('shows diary metadata, original content, failed status, and retry action', () => {
    render(<ProjectDiaryFiles projectId="project-1" canEdit={true} />);

    expect(screen.getByText('2026-07-23 · Ana')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_diary_index_failed')).toBeInTheDocument();

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_title'));

    expect(screen.getByText('CPA caiu.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_diary_reprocess'));
    expect(mockReprocess).toHaveBeenCalledWith(
      { projectId: 'project-1', entryId: 'entry-1', kind: 'manager' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
