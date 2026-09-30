import React from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios, { AxiosHeaders } from 'axios';
import type { AxiosResponse } from 'axios';
import type { TProject } from 'librechat-data-provider';
import ProjectMemoryEditor from '../ProjectMemoryEditor';
import i18n from '~/locales/i18n';

jest.mock('~/hooks', () => ({
  useHasAccess: () => true,
  useLocalize: () => (key: string) => jest.requireActual('~/locales/i18n').default.t(key),
}));
const mockPublishMutation = { mutate: jest.fn(), isLoading: false };
jest.mock('~/data-provider', () => ({
  ...jest.requireActual('~/data-provider'),
  usePublishSharedMemoryMutation: () => mockPublishMutation,
}));

const project: TProject = {
  projectId: 'project',
  name: 'Project',
  memories: [{ key: 'tone', value: 'A' }],
};
function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <RecoilRoot>
      <QueryClientProvider client={client}>
        <ProjectMemoryEditor project={project} />
      </QueryClientProvider>
    </RecoilRoot>,
  );
}

it('locks editing until the sent snapshot is saved', async () => {
  let finish!: (value: AxiosResponse<TProject>) => void;
  const update = jest.spyOn(axios, 'put').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderEditor();
  const input = screen.getByDisplayValue('A');
  await userEvent.type(input, 'B');
  const save = screen.getByRole('button', { name: i18n.t('com_ui_save') });
  await userEvent.click(save);
  await waitFor(() => expect(input).toBeDisabled());
  expect(screen.getByRole('button', { name: i18n.t('com_ui_project_add_memory') })).toBeDisabled();
  expect(screen.getByTitle(i18n.t('com_ui_delete'))).toBeDisabled();
  await userEvent.type(input, 'C');
  expect(input).toHaveValue('AB');
  expect(update).toHaveBeenCalledWith(
    expect.stringContaining('/api/projects/project'),
    JSON.stringify({ memories: [{ key: 'tone', value: 'AB' }] }),
    expect.any(Object),
  );
  await act(async () =>
    finish({
      data: { ...project, memories: [{ key: 'tone', value: 'AB' }] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: new AxiosHeaders() },
    }),
  );
  await waitFor(() => expect(input).toBeEnabled());
  expect(save).toBeDisabled();
});

it('keeps edits and shows an actionable save failure', async () => {
  jest.spyOn(axios, 'put').mockRejectedValue(new Error('offline'));
  renderEditor();
  const input = screen.getByDisplayValue('A');
  await userEvent.type(input, 'B');
  const save = screen.getByRole('button', { name: i18n.t('com_ui_save') });
  await userEvent.click(save);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('com_ui_project_memories_save_error'),
  );
  expect(input).toHaveValue('AB');
  expect(save).toBeEnabled();
});

it('publishes local memory with replacement only after sourceReplaced', async () => {
  const mutate = jest.fn((_payload, callbacks) => callbacks.onSuccess({ sourceReplaced: true }));
  mockPublishMutation.mutate = mutate;
  renderEditor();

  await userEvent.click(screen.getByRole('button', { name: i18n.t('com_ui_publish_memory') }));
  await userEvent.click(screen.getByLabelText(i18n.t('com_ui_replace_local_memory_link')));
  fireEvent.click(
    (await screen.findAllByRole('button', { name: i18n.t('com_ui_publish_memory') })).at(-1)!,
  );

  expect(mutate).toHaveBeenCalledWith(
    { source: { type: 'project', projectId: 'project', key: 'tone' }, replaceWithLink: true },
    expect.any(Object),
  );
  expect(screen.queryByDisplayValue('A')).not.toBeInTheDocument();
});

it('keeps local memory when publishing fails', async () => {
  const mutate = jest.fn((_payload, callbacks) => callbacks.onError?.(new Error('offline')));
  mockPublishMutation.mutate = mutate;
  renderEditor();

  await userEvent.click(screen.getByRole('button', { name: i18n.t('com_ui_publish_memory') }));
  fireEvent.click(
    (await screen.findAllByRole('button', { name: i18n.t('com_ui_publish_memory') })).at(-1)!,
  );

  expect(screen.getByDisplayValue('A')).toBeInTheDocument();
});
