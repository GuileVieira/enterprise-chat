import React from 'react';
import { render, screen, fireEvent, waitFor } from 'test/layout-test-utils';
import axios from 'axios';
import Keys from './Keys';
import Catalog from './Catalog';

beforeEach(() => {
  jest.spyOn(axios, 'get').mockImplementation(async (url) => ({
    data: String(url).includes('/catalog')
      ? {
          tenantId: 'test-keys',
          ownerId: 'owner',
          agents: [
            { id: 'a', name: 'Agent A' },
            { id: 'b', name: 'Agent B' },
          ],
          projects: [
            { projectId: 'p', name: 'Project P' },
            { projectId: 'q', name: 'Project Q' },
          ],
        }
      : {
          keys: [
            { id: 'key-1', name: 'Existing key', keyPrefix: 'sk-test', createdAt: '2026-01-01' },
          ],
        },
  }));
});
it('creates a named key with all resources by default and shows its secret only after success', async () => {
  const create = jest.spyOn(axios, 'post').mockResolvedValue({
    data: {
      id: 'new-key',
      name: 'Local CLI',
      keyPrefix: 'sk-test',
      key: 'test-only-secret',
      createdAt: '2026-01-01',
    },
  });
  render(<Keys tenantId="create-test" />);
  fireEvent.click(screen.getByRole('button', { name: 'New key' }));
  const input = await screen.findByRole('textbox', { name: 'Key Name' });
  fireEvent.change(input, { target: { value: ' Local CLI ' } });
  const submit = screen.getByRole('button', { name: 'Create API Key' });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      expect.stringContaining('tenantId=create-test'),
      JSON.stringify({ name: 'Local CLI', resourceAccess: {} }),
      expect.any(Object),
    ),
  );
  expect(await screen.findByLabelText('Your API Key')).toHaveValue('test-only-secret');
});
it('saves selected resources on an existing key without generating a replacement secret', async () => {
  const update = jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} });
  const create = jest.spyOn(axios, 'post');
  render(<Keys tenantId="edit-test" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit access: Existing key' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Agents: Agent A' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      expect.stringContaining('/key-1?tenantId=edit-test'),
      JSON.stringify({ resourceAccess: { agentIds: ['b'] } }),
      expect.any(Object),
    ),
  );
  expect(create).not.toHaveBeenCalled();
});
it('shows a readable REST OpenAPI request instead of a chat-completion payload', () => {
  render(<Catalog tenantId="catalog-test" />);
  const example = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Example request' });
  expect(example).toHaveAttribute('readonly');
  expect(example.value).toContain('/api/integrations/v1/openapi.json');
  expect(example.value).not.toContain('chat/completions');
});

it('keeps the edited selection available when saving fails', async () => {
  const update = jest.spyOn(axios, 'patch').mockRejectedValue(new Error('Temporary failure'));
  render(<Keys tenantId="failed-edit" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit access: Existing key' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Projects: Project P' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(update).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  expect(screen.getByRole('checkbox', { name: 'Projects: Project P' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Projects: Project Q' })).toBeChecked();
});
