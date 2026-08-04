import type { Document } from 'mongoose';

export interface IMeetingUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface IMeetingInsights {
  summary: string;
  decisions: string[];
  nextSteps: string[];
  tasks: string[];
}

export interface IMeeting extends Document {
  projectId: string;
  tenantId?: string;
  userId: string;
  title: string;
  status: 'uploading' | 'upload_failed' | 'submitting' | 'processing' | 'completed' | 'failed';
  duration: number;
  assemblyTranscriptId: string;
  mimeType?: string;
  transcript: string;
  utterances: IMeetingUtterance[];
  speakerNames: Map<string, string>;
  insights: IMeetingInsights;
  indexStatus: 'pending' | 'indexed' | 'failed';
  indexError?: string;
  indexedAt?: Date;
  error?: string;
  recordedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
