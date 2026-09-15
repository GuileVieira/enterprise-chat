import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecretInput } from './SecretInput';

describe('SecretInput', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('shows eye icon when hidden and eye-off when visible', () => {
    render(<SecretInput value="secret" readOnly aria-label="token" />);
    const toggle = screen.getByRole('button', { name: 'Show secret' });
    expect(screen.getByTestId('secret-show-icon')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide secret' })).toContainElement(
      screen.getByTestId('secret-hide-icon'),
    );
  });

  it('morphs copy to check after a successful copy', async () => {
    render(<SecretInput value="secret-value" showCopy readOnly aria-label="token" />);
    const copyButton = screen.getByRole('button', { name: 'Copy to clipboard' });
    expect(copyButton).toContainElement(screen.getByTestId('secret-copy-icon'));

    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toContainElement(
        screen.getByTestId('secret-copied-icon'),
      );
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('secret-value');
  });
});
