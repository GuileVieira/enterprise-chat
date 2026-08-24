import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FileConfigInput } from 'librechat-data-provider';
import UploadSkillDialog from '../UploadSkillDialog';

const mockMutateAsync = jest.fn();
const mockNavigate = jest.fn();
const mockSetIsOpen = jest.fn();
const mockShowToast = jest.fn();
let mockFileConfigInput: FileConfigInput | undefined = {
  skills: {
    fileSizeLimit: 1,
  },
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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
      Spinner: () => React.createElement('div', { 'data-testid': 'spinner' }),
      useToastContext: () => ({
        showToast: mockShowToast,
      }),
    };
  },
  { virtual: true },
);

jest.mock('~/data-provider', () => ({
  useGetFileConfig: ({ select }: { select?: (data: FileConfigInput | undefined) => unknown }) => ({
    data: select != null ? select(mockFileConfigInput) : mockFileConfigInput,
  }),
  useImportSkillMutation: () => ({
    mutateAsync: mockMutateAsync,
    isLoading: false,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize:
    () =>
    (key: string, params?: Record<string, string | number | undefined>): string => {
      const translations: Record<string, string> = {
        com_ui_skill_upload_title: 'Upload skill',
        com_ui_skill_upload_drag: 'Drag and drop or click to upload',
        com_ui_skill_upload_requirements: 'File requirements',
        com_ui_skill_upload_req_md:
          '.md file must contain skill name and description formatted in YAML',
        com_ui_skill_upload_req_zip: '.zip or .skill file must include a SKILL.md file',
        com_ui_skill_upload_req_size: `File size must not exceed ${params?.[0]} MB`,
        com_ui_skill_upload_size_error: `Skill import must not exceed ${params?.[0]} MB`,
        com_ui_skill_created: 'Skill created',
        com_ui_create_skill_upload_error: 'Failed to read the uploaded file',
        com_ui_skill_select_parent_folder: 'Select parent folder with multiple skills',
        com_ui_skill_folder_empty: 'No skill folders found',
        com_ui_skill_folder_result: `${params?.[0]} of ${params?.[1]} skills imported`,
        com_ui_skill_import_pending: 'Waiting',
        com_ui_skill_import_success: 'Imported',
        com_ui_skill_import_error: 'Failed',
      };
      return translations[key] ?? key;
    },
}));

jest.mock('~/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Upload input was not rendered');
  }
  return input;
}

function directoryFile(path: string): File {
  const file = new File(['---\nname: test\ndescription: test skill\n---'], 'SKILL.md');
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

describe('UploadSkillDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ _id: 'skill-1' });
    mockFileConfigInput = {
      skills: {
        fileSizeLimit: 1,
      },
    };
  });

  it('renders the configured skill import size limit', () => {
    render(<UploadSkillDialog isOpen={true} setIsOpen={mockSetIsOpen} />);

    expect(screen.getByText('File size must not exceed 1 MB')).toBeInTheDocument();
  });

  it('renders fractional configured skill import size limits exactly', () => {
    mockFileConfigInput = {
      skills: {
        fileSizeLimit: 1.06,
      },
    };

    render(<UploadSkillDialog isOpen={true} setIsOpen={mockSetIsOpen} />);

    expect(screen.getByText('File size must not exceed 1.06 MB')).toBeInTheDocument();
  });

  it('rejects files above the configured skill import limit before upload', async () => {
    const { container } = render(<UploadSkillDialog isOpen={true} setIsOpen={mockSetIsOpen} />);
    const file = new File([new Uint8Array(1024 * 1024 + 1)], 'too-large.skill', {
      type: 'application/zip',
    });

    fireEvent.change(getFileInput(container), {
      target: {
        files: [file],
      },
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        status: 'error',
        message: 'Skill import must not exceed 1 MB',
      }),
    );
  });

  it('uploads files exactly at the configured skill import limit', async () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    const { container } = render(<UploadSkillDialog isOpen={true} setIsOpen={mockSetIsOpen} />);
    const file = new File([new Uint8Array(1024 * 1024)], 'exact-limit.skill', {
      type: 'application/zip',
    });

    fireEvent.change(getFileInput(container), {
      target: {
        files: [file],
      },
    });

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledWith('file', file, file.name);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(expect.any(FormData)));
    appendSpy.mockRestore();
  });

  it('uploads files under the configured skill import limit', async () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    const { container } = render(<UploadSkillDialog isOpen={true} setIsOpen={mockSetIsOpen} />);
    const file = new File([new Uint8Array(1024)], 'small.skill', {
      type: 'application/zip',
    });

    fireEvent.change(getFileInput(container), {
      target: {
        files: [file],
      },
    });

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledWith('file', file, file.name);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(expect.any(FormData)));
    appendSpy.mockRestore();
  });

  it('imports every skill subfolder from a selected parent folder', async () => {
    const { container } = render(<UploadSkillDialog isOpen={true} setIsOpen={mockSetIsOpen} />);
    const directoryInput = container.querySelector('input[webkitdirectory]');
    if (!(directoryInput instanceof HTMLInputElement)) {
      throw new Error('Directory input was not rendered');
    }

    fireEvent.change(directoryInput, {
      target: {
        files: [directoryFile('skills/meta-ads/SKILL.md'), directoryFile('skills/copy/SKILL.md')],
      },
    });

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Imported')).toHaveLength(2);
    expect(mockShowToast).toHaveBeenCalledWith({
      status: 'success',
      message: '2 of 2 skills imported',
    });
  });
});
