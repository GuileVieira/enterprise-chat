import React, { useMemo, useState } from 'react';
import '@testing-library/jest-dom';
import { DndProvider } from 'react-dnd';
import { useForm } from 'react-hook-form';
import { RecoilRoot, useRecoilState } from 'recoil';
import userEvent from '@testing-library/user-event';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryKeys, FileSources, EModelEndpoint, PermissionBits } from 'librechat-data-provider';
import type { TFile, TFileUpload, TConversation } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, ChatFormProvider } from '~/Providers';
import { AuthContextProvider } from '~/hooks/AuthContext';
import DragDropWrapper from '../Files/DragDropWrapper';
import ChatForm from '../ChatForm';
import store from '~/store';

const mockUpload = jest.fn();
const mockAsk = jest.fn();

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      uploadImage: (...args: unknown[]) => mockUpload(...args),
      uploadFile: (...args: unknown[]) => mockUpload(...args),
    },
  };
});

const conversation = {
  conversationId: 'new',
  endpoint: EModelEndpoint.openAI,
  model: 'gpt-4o',
  title: 'New Chat',
} as TConversation;

const uploadResponse = {
  message: 'File uploaded',
  file_id: 'server-file-id',
  temp_file_id: 'temp-file-id',
  filename: 'pasted.png',
  filepath: '/images/pasted.png',
  type: 'image/png',
  bytes: 2048,
  height: 100,
  width: 100,
  source: FileSources.local,
  embedded: false,
} as unknown as TFileUpload;

/** jsdom never decodes images; the app only starts the upload once one loads. */
class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 100;
  height = 100;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

function Harness() {
  const [files, setFiles] = useRecoilState(store.filesByIndex(0));
  const [isSubmitting] = useRecoilState(store.isSubmittingFamily(0));
  const [, setFilesLoading] = useState(false);
  const methods = useForm<ChatFormValues>({ defaultValues: { text: '' } });

  const chatHelpers = useMemo(
    () =>
      ({
        index: 0,
        conversation,
        setConversation: () => undefined,
        files,
        setFiles,
        isSubmitting,
        setIsSubmitting: () => undefined,
        filesLoading: false,
        setFilesLoading,
        newConversation: () => undefined,
        handleStopGenerating: () => undefined,
        stopGenerating: () => undefined,
        getMessages: () => [],
        setMessages: () => undefined,
        ask: mockAsk,
        regenerate: () => undefined,
        setSiblingIdx: () => undefined,
        showPopover: false,
        setShowPopover: () => undefined,
        abortScroll: false,
        setAbortScroll: () => undefined,
        preset: null,
        setPreset: () => undefined,
        optionSettings: {},
        setOptionSettings: () => undefined,
        handleRegenerate: () => undefined,
        handleContinue: () => undefined,
      }) as unknown as React.ContextType<typeof ChatContext>,
    [files, setFiles, isSubmitting],
  );

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <DragDropWrapper>
          <ChatForm
            index={0}
            isLandingPage={false}
            footerBelow={false}
            centerFormOnLanding={false}
          />
        </DragDropWrapper>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

function renderComposer({ legacyUploadUX = false }: { legacyUploadUX?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(
    [QueryKeys.fileConfig],
    legacyUploadUX
      ? { legacyFileUploadUX: true, ocr: { supportedMimeTypes: ['image/png'] } }
      : { ocr: { supportedMimeTypes: ['image/png'] } },
  );
  if (conversation.projectId) {
    queryClient.setQueryData(['projectPermissions', conversation.projectId], {
      permissionBits: PermissionBits.VIEW | PermissionBits.EDIT,
    });
  }
  queryClient.setQueryData<TFile[]>([QueryKeys.files], []);
  queryClient.setQueryData([QueryKeys.endpoints], { [EModelEndpoint.openAI]: { order: 0 } });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <Router>
          <AuthContextProvider authConfig={{ loginRedirect: '', test: true }}>
            <DndProvider backend={HTML5Backend}>
              <Harness />
            </DndProvider>
          </AuthContextProvider>
        </Router>
      </RecoilRoot>
    </QueryClientProvider>,
  );
}

const pasteImage = (textarea: HTMLElement) => {
  const file = new File(['image-bytes'], 'pasted.png', { type: 'image/png' });
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      files: [file],
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      types: ['Files'],
      getData: () => '',
    },
  });
  fireEvent(textarea, event);
};

/**
 * The upload-destination dialog is opened by the paste itself, so Radix has no
 * trigger to return focus to when it closes and used to leave focus on
 * `document.body` — which reads to the user as "the send button is enabled but
 * Enter does nothing", since Enter-to-send is a textarea key handler.
 *
 * Check focus in legacy mode here; unified mode is covered separately below.
 */
describe('composer focus after a pasted upload', () => {
  beforeEach(() => {
    localStorage.clear();
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = jest.fn();
    (global as unknown as { Image: unknown }).Image = StubImage;
    mockUpload.mockReset();
    mockAsk.mockReset();
    conversation.projectId = undefined;
    conversation.endpoint = EModelEndpoint.openAI;
    mockUpload.mockImplementation((body: FormData) =>
      Promise.resolve({ ...uploadResponse, temp_file_id: body.get('file_id') as string }),
    );
  });

  test('returns focus to the composer when the upload dialog closes', async () => {
    renderComposer({ legacyUploadUX: true });

    const textarea = await screen.findByTestId('text-input');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'hi');
    expect(textarea).toHaveFocus();

    pasteImage(textarea);
    const option = await screen.findByRole('button', { name: /analyze image|analisar imagem/i });
    expect(textarea).not.toHaveFocus();

    await userEvent.click(option);
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    await waitFor(() => expect(textarea).toHaveFocus());
  }, 20000);

  test('Enter still sends after a pasted upload, with no further typing', async () => {
    renderComposer({ legacyUploadUX: true });

    const textarea = await screen.findByTestId('text-input');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'hi');

    pasteImage(textarea);
    const option = await screen.findByRole('button', { name: /analyze image|analisar imagem/i });
    await userEvent.click(option);
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('send-button')).toBeEnabled());
    await waitFor(() => expect(textarea).toHaveFocus());

    /** Straight to the keyboard: clicking or typing first would restore focus
     * on its own and hide the regression this covers. */
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(mockAsk).toHaveBeenCalled());
    expect(mockAsk.mock.calls[0][0]).toEqual(expect.objectContaining({ text: 'hi' }));
  }, 20000);
});

/**
 * Unified upload asks before sending a pasted image, even when only visual delivery
 * is available. The composer regains focus after the choice.
 */
describe('composer focus after a pasted upload in unified mode', () => {
  beforeEach(() => {
    localStorage.clear();
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = jest.fn();
    (global as unknown as { Image: unknown }).Image = StubImage;
    mockUpload.mockReset();
    mockAsk.mockReset();
    conversation.projectId = undefined;
    conversation.endpoint = EModelEndpoint.openAI;
    mockUpload.mockImplementation((body: FormData) =>
      Promise.resolve({ ...uploadResponse, temp_file_id: body.get('file_id') as string }),
    );
  });

  test('cancels image choice without uploading and restores composer focus', async () => {
    renderComposer();
    const textarea = await screen.findByTestId('text-input');
    await userEvent.click(textarea);
    pasteImage(textarea);

    const dialog = await screen.findByRole('dialog', {
      name: /how would you like to use this image|como deseja usar a imagem/i,
    });
    await userEvent.click(screen.getByRole('button', { name: /cancel|cancelar/i }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(textarea).toHaveFocus());
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('lets a pasted image choose visual delivery or OCR indexing', async () => {
    conversation.projectId = 'project-1';
    renderComposer();
    const textarea = await screen.findByTestId('text-input');
    pasteImage(textarea);

    const visual = await screen.findByRole('button', { name: /analyze image|analisar imagem/i });
    expect(
      screen.getByRole('dialog', {
        name: /how would you like to use this image|como deseja usar a imagem/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /extract the text \(ocr\) and add it to the project files|extraia o texto \(ocr\) e adicione aos arquivos do projeto/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save text to project|salvar texto no projeto/i }),
    ).toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();

    await userEvent.click(visual);
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect((mockUpload.mock.calls[0][0] as FormData).get('tool_resource')).toBeNull();
    expect((mockUpload.mock.calls[0][0] as FormData).get('image_delivery')).toBe('provider');
  });

  test('asks before a clip-selected image and uploads visual only after selection', async () => {
    const { container } = renderComposer();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['image-bytes'], 'clip.png')] },
    });

    const visual = await screen.findByRole('button', { name: /analyze image|analisar imagem/i });
    expect(mockUpload).not.toHaveBeenCalled();
    await userEvent.click(visual);
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect((mockUpload.mock.calls[0][0] as FormData).get('image_delivery')).toBe('provider');
    expect(((mockUpload.mock.calls[0][0] as FormData).get('file') as File).type).toBe('image/png');
  });

  test('asks before a dropped image and uploads visual only after selection', async () => {
    const { container } = renderComposer();
    const dropArea = container.querySelector('.relative.flex.h-full.w-full') as HTMLElement;
    const file = new File(['image-bytes'], 'drop.png', { type: 'image/png' });
    const dataTransfer = { files: [file], items: [], types: ['Files'] };
    fireEvent.dragEnter(dropArea, { dataTransfer });
    fireEvent.dragOver(dropArea, { dataTransfer });
    fireEvent.drop(dropArea, { dataTransfer });

    const visual = await screen.findByRole('button', { name: /analyze image|analisar imagem/i });
    expect(mockUpload).not.toHaveBeenCalled();
    await userEvent.click(visual);
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect((mockUpload.mock.calls[0][0] as FormData).get('image_delivery')).toBe('provider');
  });

  test('indexes a pasted image only after choosing OCR', async () => {
    conversation.projectId = 'project-1';
    renderComposer();
    pasteImage(await screen.findByTestId('text-input'));

    await userEvent.click(
      await screen.findByRole('button', { name: /save text to project|salvar texto no projeto/i }),
    );
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect((mockUpload.mock.calls[0][0] as FormData).get('tool_resource')).toBe('file_search');
  });

  test('saves OCR indexing to project files when the chat belongs to a project', async () => {
    conversation.projectId = 'project-1';
    renderComposer();
    pasteImage(await screen.findByTestId('text-input'));

    await userEvent.click(
      await screen.findByRole('button', { name: /save text to project|salvar texto no projeto/i }),
    );
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const formData = mockUpload.mock.calls[0][0] as FormData;
    expect(formData.get('tool_resource')).toBe('file_search');
    expect(formData.get('image_delivery')).toBeNull();
    expect(formData.get('projectId')).toBe('project-1');
  });

  test('sends the visual choice to the model even inside a project chat', async () => {
    conversation.projectId = 'project-1';
    renderComposer();
    pasteImage(await screen.findByTestId('text-input'));

    await userEvent.click(
      await screen.findByRole('button', { name: /analyze image|analisar imagem/i }),
    );
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const formData = mockUpload.mock.calls[0][0] as FormData;
    expect(formData.get('message_file')).toBe('true');
    expect(formData.get('projectId')).toBeNull();
    expect(formData.get('tool_resource')).toBeNull();
    expect(formData.get('image_delivery')).toBe('provider');
  });

  test('asks before uploading a pasted image when OCR is unavailable', async () => {
    renderComposer();

    const textarea = await screen.findByTestId('text-input');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'hi');
    expect(textarea).toHaveFocus();

    pasteImage(textarea);

    const visual = await screen.findByRole('button', { name: /analyze image|analisar imagem/i });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /extract text|extrair texto/i })).toBeNull();

    await userEvent.click(visual);
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    await waitFor(() => expect(textarea).toHaveFocus());
  }, 20000);

  test('Enter still sends after a pasted upload, with no further typing', async () => {
    renderComposer();

    const textarea = await screen.findByTestId('text-input');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'hi');

    pasteImage(textarea);
    await userEvent.click(
      await screen.findByRole('button', { name: /analyze image|analisar imagem/i }),
    );
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('send-button')).toBeEnabled());

    /** Straight to the keyboard, as above: any click or keystroke first would restore
     * focus on its own and hide a regression. */
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(mockAsk).toHaveBeenCalled());
    expect(mockAsk.mock.calls[0][0]).toEqual(expect.objectContaining({ text: 'hi' }));
  }, 20000);
});
