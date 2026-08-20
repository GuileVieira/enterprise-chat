const ARTIFACT_PATTERN = /:::artifact(?:\{([^}]*)\})?\s*([\s\S]*?)\n:::/g;

const normalizeArtifactKey = (value) => value.replace(/\s+/g, '_').toLowerCase();

const getAttribute = (attributes, name, fallback) =>
  attributes?.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? fallback;

const keepSharedArtifact = (text, artifactId, messageId) => {
  if (typeof text !== 'string') {
    return '';
  }

  const stableId = artifactId.split('_').slice(0, -1).join('_');
  for (const match of text.matchAll(ARTIFACT_PATTERN)) {
    const attributes = match[1];
    const candidate = normalizeArtifactKey(
      `${getAttribute(attributes, 'identifier', 'lc-no-identifier')}_${getAttribute(attributes, 'type', 'unknown')}_${getAttribute(attributes, 'title', 'untitled')}_${messageId}`,
    );
    if (candidate === artifactId || (stableId && candidate.startsWith(`${stableId}_`))) {
      return match[0];
    }
  }
  return '';
};

const matchesToolArtifact = (value, artifactId) =>
  value && typeof value === 'object' && `tool-artifact-${value.file_id}` === artifactId;

const sanitizeSharedArtifactMessages = (messages, artifactId) =>
  messages.map((message) => ({
    messageId: message.messageId,
    parentMessageId: message.parentMessageId,
    conversationId: message.conversationId,
    isCreatedByUser: message.isCreatedByUser,
    text: keepSharedArtifact(message.text, artifactId, message.messageId),
    content: message.content
      ?.map((part) =>
        part?.type === 'text'
          ? { type: 'text', text: keepSharedArtifact(part.text, artifactId, message.messageId) }
          : part,
      )
      .filter((part) =>
        part?.type === 'text' ? part.text : matchesToolArtifact(part, artifactId),
      ),
    files: message.files?.filter((file) => matchesToolArtifact(file, artifactId)),
    attachments: message.attachments?.filter((file) => matchesToolArtifact(file, artifactId)),
  }));

module.exports = { sanitizeSharedArtifactMessages };
