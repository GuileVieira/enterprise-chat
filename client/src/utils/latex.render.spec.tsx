import React from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ReactMarkdown from 'react-markdown';
import { render, screen } from '@testing-library/react';
import type { Options as ReactMarkdownOptions } from 'react-markdown';
import { remarkSingleDollarMath } from './latex';

const renderProductionMarkdown = (content: string) =>
  render(
    <ReactMarkdown
      remarkPlugins={
        [
          remarkGfm,
          [remarkMath, { singleDollarTextMath: false }],
          remarkSingleDollarMath,
        ] as ReactMarkdownOptions['remarkPlugins']
      }
      rehypePlugins={[rehypeKatex] as ReactMarkdownOptions['rehypePlugins']}
    >
      {content}
    </ReactMarkdown>,
  );

test('renders spaced Brazilian real values as text', () => {
  const content = 'Investimento entre R$ **500 mil** e R$ **780 mil** por mês';
  const { container } = renderProductionMarkdown(content);

  expect(container).toHaveTextContent('Investimento entre R$ 500 mil e R$ 780 mil por mês');
  expect(screen.getByText('500 mil')).toBeInTheDocument();
  expect(screen.getByText('780 mil')).toBeInTheDocument();
  expect(container.querySelector('.katex')).not.toBeInTheDocument();
});

test('renders compact BRL, dollar ranges, code, and mhchem through the production pipeline', () => {
  const { container } = renderProductionMarkdown(
    'R$500; $100-$200; `$lookup`; water $\\ce{H2O}$ and math $E=mc^2$.',
  );

  expect(container).toHaveTextContent('R$500; $100-$200; $lookup; water');
  expect(container.querySelector('code')).toHaveTextContent('$lookup');
  expect(container.querySelectorAll('.katex')).toHaveLength(2);
  expect(container.querySelector('.katex-error')).not.toBeInTheDocument();
});
