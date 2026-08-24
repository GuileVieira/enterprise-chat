import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TSkill, TSkillSummary } from 'librechat-data-provider';
import SkillSelectDialog from '../SkillSelectDialog';

const mockNavigate = jest.fn();
const mockSetValue = jest.fn();
const mockSetIsOpen = jest.fn();
const editSkillLabel = 'Edit skill';

const skill = {
  _id: 'skill-1',
  name: 'Meta Ads Expert',
  description: 'Analisa campanhas',
  author: 'owner-1',
  authorName: 'Owner',
  isPublic: true,
  body: '# Meta Ads Expert',
} as TSkill & TSkillSummary;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('react-hook-form', () => ({
  useFormContext: () => ({ control: {}, setValue: mockSetValue }),
  useWatch: () => [],
}));

jest.mock(
  '@librechat/client',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      OGDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
        open ? React.createElement('div', null, children) : null,
      OGDialogContent: ({ children }: { children: ReactNode }) =>
        React.createElement('div', null, children),
    };
  },
  { virtual: true },
);

jest.mock('~/data-provider', () => ({
  useListSkillsQuery: () => ({ data: { skills: [skill] } }),
  useGetSkillByIdQuery: (id: string | null) => ({
    data: id === skill._id ? skill : undefined,
    isError: false,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_ui_view_skill: 'View skill',
      com_ui_back: 'Back',
      com_ui_close: 'Close',
      com_ui_search_skills: 'Search skills',
      com_ui_add_skills: 'Add Skills',
    })[key] ?? key,
  useAuthContext: () => ({ user: { id: 'admin-1', role: 'ADMIN' } }),
  useCategories: () => ({ categories: [] }),
  useHasAccess: () => true,
  useSkillFavorites: () => ({ isFavorite: () => false, toggle: jest.fn() }),
}));

jest.mock('~/components/Prompts', () => ({
  CategoryIcon: () => null,
}));

jest.mock('~/components/Skills/display/SkillDetail', () => ({
  __esModule: true,
  default: ({ skill: selectedSkill, onEdit }: { skill: TSkill; onEdit?: () => void }) => (
    <div>
      <p>{selectedSkill.body}</p>
      <button type="button" onClick={onEdit}>
        {editSkillLabel}
      </button>
    </div>
  ),
}));

jest.mock('~/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

describe('SkillSelectDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('previews a skill without toggling it and lets an admin open the editor', () => {
    render(<SkillSelectDialog isOpen={true} setIsOpen={mockSetIsOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'View skill' }));

    expect(screen.getByText('# Meta Ads Expert')).toBeInTheDocument();
    expect(mockSetValue).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }));

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith('/skills/skill-1/edit');
  });
});
