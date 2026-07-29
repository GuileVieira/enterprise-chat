import { useMemo } from 'react';
import type { ToolCallResult } from 'librechat-data-provider';

import { mapToolCalls, logger } from '~/utils';
import { useGetToolCalls } from '~/data-provider';

type ToolCallsMap = {
  [x: string]: ToolCallResult[] | undefined;
};

export default function useToolCallsMap({
  conversationId,
}: {
  conversationId: string;
}): ToolCallsMap | undefined {
  const { data: toolCallsMap = null } = useGetToolCalls(
    { conversationId },
    {
      select: (res) => mapToolCalls(res),
    },
  );

  const result = useMemo<ToolCallsMap | undefined>(() => {
    return toolCallsMap !== null ? toolCallsMap : undefined;
  }, [toolCallsMap]);

  if (result !== undefined) {
    logger.log('tools', 'tool calls map:', result);
  }
  return result;
}
