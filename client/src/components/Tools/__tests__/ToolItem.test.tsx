import React from 'react';
import { render, screen } from '@testing-library/react';
import ToolItem from '../ToolItem';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_ui_add: 'Add',
      com_nav_tool_remove: 'Remove',
      com_ui_logo: 'Logo',
    };
    return labels[key] || key;
  },
}));

describe('ToolItem', () => {
  it('uses neutral button colors for installed tools in dark mode', () => {
    render(
      <div className="dark">
        <ToolItem
          tool={{
            name: 'Google',
            pluginKey: 'google',
            description: 'Search',
          }}
          isInstalled={true}
          onAddTool={jest.fn()}
          onRemoveTool={jest.fn()}
        />
      </div>,
    );

    const removeButton = screen.getByRole('button', { name: 'Remove Google' });
    expect(removeButton).toHaveClass('btn-neutral');
    expect(removeButton.className).not.toContain('dark:bg-gray-50');
  });
});
