import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { dataService } from 'librechat-data-provider';
import type { TSkill } from 'librechat-data-provider';
import SkillList from './SkillList';

jest.mock('@librechat/client', () => ({
  Skeleton: () => <div />,
  TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('librechat-data-provider', () => ({
  ...jest.requireActual('librechat-data-provider'),
  dataService: { exportSkills: jest.fn() },
}));

jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));

jest.mock('./SkillListItem', () => ({
  __esModule: true,
  default: ({
    skill,
    selected,
    onToggleSelected,
  }: {
    skill: TSkill;
    selected: boolean;
    onToggleSelected: (id: string) => void;
  }) => (
    <label>
      {skill.name}
      <input
        aria-label={`select-${skill.name}`}
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelected(skill._id)}
      />
    </label>
  ),
}));

const skills = [
  { _id: 'skill-1', name: 'meta-ads' },
  { _id: 'skill-2', name: 'analytics' },
] as TSkill[];

describe('SkillList export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:skills');
    URL.revokeObjectURL = jest.fn();
  });

  it('exports only the selected skills', async () => {
    jest.mocked(dataService.exportSkills).mockResolvedValue({
      data: new Blob(['zip']),
      headers: { 'content-disposition': 'attachment; filename="meta-ads.skill"' },
    } as never);
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();

    render(
      <MemoryRouter>
        <SkillList skills={skills} isLoading={false} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('select-meta-ads'));
    fireEvent.click(screen.getByLabelText('com_ui_skill_export_selected'));

    await waitFor(() => expect(dataService.exportSkills).toHaveBeenCalledWith(['skill-1']));
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:skills');
    click.mockRestore();
  });
});
