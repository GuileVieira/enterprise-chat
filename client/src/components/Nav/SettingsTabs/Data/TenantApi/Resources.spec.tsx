import React, { useState } from 'react';
import { render, screen, fireEvent } from 'test/layout-test-utils';
import type { TApiKeyResources, TTenantApiCatalog } from 'librechat-data-provider';
import Resources from './Resources';

const catalog: TTenantApiCatalog = {
  tenantId: 'tenant-a',
  ownerId: 'owner-a',
  agents: [
    { id: 'a', name: 'First agent' },
    { id: 'b', name: 'Second agent' },
  ],
  projects: [
    { projectId: 'p', name: 'Marketing' },
    { projectId: 'q', name: 'Sales' },
  ],
};
function Editor() {
  const [value, setValue] = useState<TApiKeyResources>({});
  return (
    <>
      <Resources catalog={catalog} value={value} onChange={setValue} />
      <output aria-label="selection">{JSON.stringify(value)}</output>
    </>
  );
}
it('starts with all resources, scopes only the changed category and restores all resources', () => {
  render(<Editor />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(6);
  for (const box of screen.getAllByRole('checkbox')) expect(box).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Agents: First agent' }));
  expect(JSON.parse(screen.getByLabelText('selection').textContent ?? '')).toEqual({
    agentIds: ['b'],
  });
  expect(screen.getByRole('checkbox', { name: 'Projects: Marketing' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all: Agents' }));
  expect(JSON.parse(screen.getByLabelText('selection').textContent ?? '')).toEqual({});
});
it('searches the full project roster without clearing hidden selections', () => {
  render(<Editor />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search: Projects' }), {
    target: { value: 'Marketing' },
  });
  expect(screen.getByRole('checkbox', { name: 'Projects: Marketing' })).toBeChecked();
  expect(screen.queryByRole('checkbox', { name: 'Projects: Sales' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Projects: Marketing' }));
  expect(JSON.parse(screen.getByLabelText('selection').textContent ?? '')).toEqual({
    projectIds: ['q'],
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search: Projects' }), {
    target: { value: '' },
  });
  expect(screen.getByRole('checkbox', { name: 'Projects: Sales' })).toBeChecked();
});
