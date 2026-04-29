import React from 'react';
import { render } from '@testing-library/react';
import CategoryIcon from '../CategoryIcon';

describe('CategoryIcon', () => {
  it('renders emoji when icon prop is provided', () => {
    const { container } = render(<CategoryIcon category="briefing" icon="📋" />);
    const span = container.querySelector('span');
    expect(span).toHaveTextContent('📋');
  });

  it('renders Lucide icon when no icon prop is provided', () => {
    const { container } = render(<CategoryIcon category="code" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders FileText fallback for unknown categories', () => {
    const { container } = render(<CategoryIcon category="unknown_category" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CategoryIcon category="briefing" icon="📋" className="text-xl" />);
    const span = container.querySelector('span');
    expect(span).toHaveClass('text-xl');
  });
});
