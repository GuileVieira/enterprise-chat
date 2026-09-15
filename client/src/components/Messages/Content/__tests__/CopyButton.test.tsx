import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CopyButton from '../CopyButton';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => {
  return {
    TooltipAnchor: ({ render }: { render: React.ReactElement }) => render,
  };
});

describe('CopyButton', () => {
  it('renders the copy icon when not copied', () => {
    const { container } = render(<CopyButton isCopied={false} onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'com_ui_copy' })).toBeInTheDocument();
    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveClass('scale-100', 'opacity-100');
    expect(icons[1]).toHaveClass('scale-0', 'opacity-0');
  });

  it('renders the check icon when copied', () => {
    const { container } = render(<CopyButton isCopied onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'com_ui_copied' })).toBeInTheDocument();
    const icons = container.querySelectorAll('svg');
    expect(icons[0]).toHaveClass('scale-0', 'opacity-0');
    expect(icons[1]).toHaveClass('scale-100', 'opacity-100');
  });

  it('invokes onClick when pressed', () => {
    const onClick = jest.fn();
    render(<CopyButton isCopied={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_copy' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
