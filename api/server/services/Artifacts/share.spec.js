const { sanitizeSharedArtifactMessages } = require('./share');

describe('sanitizeSharedArtifactMessages', () => {
  test('keeps only selected artifact content', () => {
    const selected =
      ':::artifact{identifier="report" type="text/html" title="Report"}\n<h1>Public</h1>\n:::';
    const other =
      ':::artifact{identifier="secret" type="text/html" title="Secret"}\n<p>Private</p>\n:::';
    const [message] = sanitizeSharedArtifactMessages(
      [
        {
          messageId: 'message-1',
          text: `conversation secret\n${selected}\n${other}`,
          attachments: [
            { file_id: 'public', text: '<h1>Tool</h1>' },
            { file_id: 'private', text: '<h1>Private</h1>' },
          ],
        },
      ],
      'report_text/html_report_original-message',
    );

    expect(message.text).toBe(selected);
    expect(message.text).not.toContain('conversation secret');
    expect(message.text).not.toContain('Private');
    expect(message.attachments).toEqual([]);
  });

  test('keeps only selected tool artifact attachment', () => {
    const [message] = sanitizeSharedArtifactMessages(
      [
        {
          messageId: 'message-1',
          text: 'conversation secret',
          attachments: [
            { file_id: 'public', text: '<h1>Public</h1>' },
            { file_id: 'private', text: '<h1>Private</h1>' },
          ],
        },
      ],
      'tool-artifact-public',
    );

    expect(message.text).toBe('');
    expect(message.attachments).toEqual([{ file_id: 'public', text: '<h1>Public</h1>' }]);
  });
});
