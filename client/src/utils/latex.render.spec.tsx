import React from 'react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ReactMarkdown from 'react-markdown';
import { render, screen } from '@testing-library/react';

import { preprocessLaTeX } from './latex';

test('renders spaced Brazilian real values as text', () => {
  const content = 'Investimento entre R$ **500 mil** e R$ **780 mil** por mês';
  const { container } = render(
    <ReactMarkdown
      remarkPlugins={[[remarkMath, { singleDollarTextMath: false }]]}
      rehypePlugins={[rehypeKatex]}
    >
      {preprocessLaTeX(content)}
    </ReactMarkdown>,
  );

  expect(container).toHaveTextContent('Investimento entre R$ 500 mil e R$ 780 mil por mês');
  expect(screen.getByText('500 mil')).toBeInTheDocument();
  expect(screen.getByText('780 mil')).toBeInTheDocument();
  expect(container.querySelector('.katex')).not.toBeInTheDocument();
});
