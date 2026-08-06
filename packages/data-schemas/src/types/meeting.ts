import type { Document } from 'mongoose';

export interface IMeetingUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface IMeetingParticipant {
  name: string;
  source: 'manual' | 'google_meet' | 'zoom' | 'teams';
  channel?: number;
}

export interface IMeetingSpeakerIdentification {
  name: string;
  source: 'unidentified' | 'assemblyai_participants' | 'channel' | 'manual';
  confidence: number | null;
  confirmed: boolean;
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
  participants: IMeetingParticipant[];
  multichannel?: boolean;
  speakerNames: Map<string, string>;
  speakerIdentifications: Map<string, IMeetingSpeakerIdentification>;
  insights: IMeetingInsights;
  indexStatus: 'pending' | 'indexed' | 'failed';
  indexError?: string;
  indexedAt?: Date;
  error?: string;
  recordedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
