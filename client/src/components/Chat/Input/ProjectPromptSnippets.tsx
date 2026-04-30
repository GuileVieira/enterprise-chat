import { memo } from 'react';
import { insertTextAtCursor, forceResize } from '~/utils/textarea';

interface PromptSnippet {
  title: string;
  content: string;
}

interface ProjectPromptSnippetsProps {
  snippets: PromptSnippet[];
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const ProjectPromptSnippets = memo(function ProjectPromptSnippets({
  snippets,
  textAreaRef,
}: ProjectPromptSnippetsProps) {
  if (!snippets || snippets.length === 0) {
    return null;
  }

  const handleClick = (content: string) => {
    if (!textAreaRef.current) {
      return;
    }
    insertTextAtCursor(textAreaRef.current, content);
    forceResize(textAreaRef.current);
    textAreaRef.current.focus();
  };

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2 pt-1">
      {snippets.map((snippet, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => handleClick(snippet.content)}
          className="inline-flex items-center rounded-full border border-border-light bg-surface-tertiary px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          {snippet.title}
        </button>
      ))}
    </div>
  );
});

export default ProjectPromptSnippets;
