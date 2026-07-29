export type MeetingStatus = 'processing' | 'completed' | 'failed';

export interface MeetingUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
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
  speakerNames: Record<string, string>;
  insights: MeetingInsights;
  indexStatus: 'pending' | 'indexed' | 'failed';
  indexError?: string;
  indexedAt?: string;
  error?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}
