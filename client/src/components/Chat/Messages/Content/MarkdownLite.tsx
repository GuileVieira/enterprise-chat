import { memo, useMemo, useLayoutEffect } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import supersub from 'remark-supersub';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import type { PluggableList } from 'unified';
import { code, codeNoExecution, a, p, img, table } from './MarkdownComponents';
import { CodeBlockProvider, ArtifactProvider } from '~/Providers';
import MarkdownErrorBoundary from './MarkdownErrorBoundary';
import { langSubset, remarkApproxTilde } from '~/utils';
import { createFadePlugin } from './animate';

const MarkdownLite = memo(
  ({
    content = '',
    codeExecution = true,
    animate = false,
  }: {
    content?: string;
    codeExecution?: boolean;
    animate?: boolean;
  }) => {
    const fade = useMemo(() => (animate ? createFadePlugin() : null), [animate]);
    const rehypePlugins: PluggableList = useMemo(
      () => [
        [rehypeKatex],
        [
          rehypeHighlight,
          {
            detect: true,
            ignoreMissing: true,
            subset: langSubset,
          },
        ],
        ...(fade == null ? [] : [fade.plugin]),
      ],
      [fade],
    );

    useLayoutEffect(() => {
      fade?.commit();
    });

    return (
      <MarkdownErrorBoundary content={content} codeExecution={codeExecution}>
        <ArtifactProvider>
          <CodeBlockProvider>
            <ReactMarkdown
              remarkPlugins={[
                remarkApproxTilde,
                /** @ts-ignore */
                supersub,
                remarkGfm,
                [remarkMath, { singleDollarTextMath: false }],
              ]}
              /** @ts-ignore */
              rehypePlugins={rehypePlugins}
              components={
                {
                  code: codeExecution ? code : codeNoExecution,
                  a,
                  p,
                  img,
                  table,
                } as {
                  [nodeType: string]: React.ElementType;
                }
              }
            >
              {content}
            </ReactMarkdown>
          </CodeBlockProvider>
        </ArtifactProvider>
      </MarkdownErrorBoundary>
    );
  },
);

export default MarkdownLite;
