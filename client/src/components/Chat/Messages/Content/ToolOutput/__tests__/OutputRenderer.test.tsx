import React from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OutputRenderer, { isError } from '../OutputRenderer';

jest.mock('copy-to-clipboard', () => jest.fn());

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/components/Messages/Content/CopyButton', () => ({
  __esModule: true,
  default: () => <button type="button" data-testid="copy-output" />,
}));

describe('OutputRenderer', () => {
  it('vertically centers the copy control beside the output', () => {
    render(<OutputRenderer text={'First line\nSecond line'} />);

    const copyPositioner = screen.getByTestId('copy-output').parentElement;
    expect(copyPositioner).toHaveClass('absolute', 'right-0', 'top-1/2', '-translate-y-1/2');
    expect(copyPositioner?.parentElement).toHaveClass('relative', 'pr-10');
  });

  it('does not treat text between bracketed prefixes as a tool-call error', () => {
    expect(isError('Error: [agent] unexpected [search] tool call failed: unavailable')).toBe(false);
  });

  it('keeps structured JSON as a raw highlighted code block', () => {
    render(<OutputRenderer text={'{"path":"**report.md**"}'} />);

    expect(screen.getByText(/"path": "\*\*report\.md\*\*"/)).toHaveClass('hljs', 'language-json');
    expect(screen.queryByText('report.md')).not.toBeInTheDocument();
  });

  it('renders prose output as safe Markdown without enabling code execution', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RecoilRoot>
          <OutputRenderer
            text={
              '**Found files**\n\n- `report.md`\n- [Open documentation](https://example.com)\n\n[Unsafe](javascript:alert(1))'
            }
          />
        </RecoilRoot>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Found files').tagName).toBe('STRONG');
    expect(screen.getByText('report.md').tagName).toBe('CODE');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Open documentation' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getByRole('link', { name: 'Unsafe' })).toHaveAttribute('href', '');
  });
});
