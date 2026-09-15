import React from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThinkingContent } from '../Thinking';

describe('ThinkingContent', () => {
  it('renders model reasoning as safe Markdown', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RecoilRoot>
          <ThinkingContent>
            {
              '**Analyzing request**\n\n- inspect `DNA`\n- [Read docs](https://example.com)\n\n[Unsafe](javascript:alert(1))'
            }
          </ThinkingContent>
        </RecoilRoot>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Analyzing request').tagName).toBe('STRONG');
    expect(screen.getByText('DNA').tagName).toBe('CODE');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Read docs' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getByRole('link', { name: 'Unsafe' })).toHaveAttribute('href', '');
  });
});
