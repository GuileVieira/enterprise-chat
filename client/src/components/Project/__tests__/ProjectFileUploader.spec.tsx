import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TFile } from 'librechat-data-provider';
import ProjectFileUploader from '../ProjectFileUploader';

type UploadCallbacks = {
  onSuccess?: () => void;
  onError?: () => void;
};

const mockUploadMutate = jest.fn();
const mockUpdateProjectMutate = jest.fn();
const mockDeleteFilesMutate = jest.fn();
const mockDownloadRefetch = jest.fn();
let mockUploadCallbacks: UploadCallbacks = {};

jest.mock('~/data-provider', () => ({
  useUploadFileMutation: jest.fn((callbacks: UploadCallbacks) => {
    mockUploadCallbacks = callbacks;
    return { mutate: mockUploadMutate };
  }),
  useUpdateProjectMutation: jest.fn(() => ({ mutate: mockUpdateProjectMutate })),
  useDeleteFilesMutation: jest.fn(() => ({ mutate: mockDeleteFilesMutate })),
  useFileDownload: jest.fn(() => ({ refetch: mockDownloadRefetch, isFetching: false })),
  useProjectMetaAdsDiaryQuery: jest.fn(() => ({
    data: { entries: [] },
    isLoading: false,
  })),
  useReprocessProjectMetaAdsDiaryMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isLoading: false,
  })),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: { filename?: string }) =>
    values?.filename ? `${key}:${values.filename}` : key,
}));

const createFile = (overrides: Partial<TFile> = {}): TFile =>
  ({
    file_id: 'file-1',
    filename: 'brief.pdf',
    filepath: '/uploads/brief.pdf',
    bytes: 1024,
    type: 'application/pdf',
    ...overrides,
  }) as TFile;

const renderUploader = (files: TFile[] = []) => {
  const onFilesChange = jest.fn();
  const view = render(
    <ProjectFileUploader
      projectId="project-1"
      files={files}
      isLoading={false}
      onFilesChange={onFilesChange}
    />,
  );
  return { ...view, onFilesChange };
};

describe('ProjectFileUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadCallbacks = {};
    mockDownloadRefetch.mockResolvedValue({ data: 'blob:brief' });
    Object.defineProperty(global.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'new-file-id'),
    });
  });

  it('downloads an attached project file', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    renderUploader([createFile({ user: 'owner-1' })]);

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_download brief.pdf' }));

    expect(mockDownloadRefetch).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('shows upload and indexing status while the request is pending', () => {
    const { container } = renderUploader();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['brief'], 'brief.pdf', { type: 'application/pdf' })] },
    });

    expect(screen.getByRole('status')).toHaveTextContent('com_ui_project_uploading:brief.pdf');
    expect(input).toBeDisabled();
    expect(mockUploadMutate).toHaveBeenCalledTimes(1);
  });

  it('refetches after success without a duplicate project update', () => {
    const { container, onFilesChange } = renderUploader();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['brief'], 'brief.pdf', { type: 'application/pdf' })] },
    });
    act(() => mockUploadCallbacks.onSuccess?.());

    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows terminal indexing status for each file', () => {
    renderUploader([
      createFile({ file_id: 'indexed', embedded: true }),
      createFile({ file_id: 'not-indexed', filename: 'notes.txt', embedded: false }),
    ]);

    expect(screen.getByText('com_ui_indexed')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_file_not_indexed')).toBeInTheDocument();
  });

  it('clears pending state and shows an error when upload fails', () => {
    const { container } = renderUploader();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['brief'], 'brief.pdf', { type: 'application/pdf' })] },
    });
    act(() => mockUploadCallbacks.onError?.());

    expect(screen.getByText('com_ui_project_upload_error')).toBeInTheDocument();
    expect(input).not.toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
