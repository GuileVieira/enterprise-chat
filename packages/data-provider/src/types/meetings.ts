export type MeetingStatus =
  | 'uploading'
  | 'upload_failed'
  | 'submitting'
  | 'processing'
  | 'completed'
  | 'failed';

export interface MeetingUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface MeetingParticipant {
  name: string;
  source: 'manual' | 'google_meet' | 'zoom' | 'teams';
  channel?: number;
}

export interface MeetingSpeakerIdentification {
  name: string;
  source: 'unidentified' | 'assemblyai_participants' | 'channel' | 'manual';
  confidence: number | null;
  confirmed: boolean;
}

export interface MeetingInsights {
  summary: string;
  decisions: string[];
  nextSteps: string[];
  tasks: string[];
}

export interface ProjectMeeting {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  status: MeetingStatus;
  duration: number;
  transcript: string;
  utterances: MeetingUtterance[];
  participants?: MeetingParticipant[];
  multichannel?: boolean;
  speakerNames: Record<string, string>;
  speakerIdentifications?: Record<string, MeetingSpeakerIdentification>;
  insights: MeetingInsights;
  indexStatus: 'pending' | 'indexed' | 'failed';
  indexError?: string;
  indexedAt?: string;
  error?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}
