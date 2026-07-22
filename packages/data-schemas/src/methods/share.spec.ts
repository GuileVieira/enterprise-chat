import { Constants } from 'librechat-data-provider';
import type { IMessage } from '~/types';
import { getMessagesUpToTarget } from './share';

describe('getMessagesUpToTarget', () => {
  it('returns only the target branch, not sibling branches', () => {
    const noParent = Constants.NO_PARENT as unknown as string;
    const messages: Pick<IMessage, 'messageId' | 'parentMessageId'>[] = [
      { messageId: 'root-a', parentMessageId: noParent },
      { messageId: 'root-b', parentMessageId: noParent },
      { messageId: 'a-child', parentMessageId: 'root-a' },
      { messageId: 'b-child', parentMessageId: 'root-b' },
      { messageId: 'target', parentMessageId: 'a-child' },
    ];

    expect(getMessagesUpToTarget(messages, 'target').map((message) => message.messageId)).toEqual([
      'root-a',
      'a-child',
      'target',
    ]);
  });
});
