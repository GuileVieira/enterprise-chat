import type { Document } from 'mongoose';

export type TrafficDiaryStatus = 'draft' | 'completed';
export type TrafficDiaryEventType = 'created' | 'completed' | 'reopened';

export interface ITrafficDiaryActor {
  id: string;
  name?: string;
  email?: string;
}

export interface ITrafficDiaryAnswer {
  id: string;
  question: string;
  answer: string;
  parentQuestionId?: string;
}

export interface ITrafficDiaryEvent {
  type: TrafficDiaryEventType;
  actor: ITrafficDiaryActor;
  at: Date;
}

export interface ITrafficDiaryEntry extends Document {
  projectId: string;
  tenantId?: string;
  weekStart: string;
  status: TrafficDiaryStatus;
  answers: ITrafficDiaryAnswer[];
  createdBy: ITrafficDiaryActor;
  lastEditedBy?: ITrafficDiaryActor;
  completedBy?: ITrafficDiaryActor;
  completedAt?: Date;
  events: ITrafficDiaryEvent[];
  createdAt?: Date;
  updatedAt?: Date;
}
