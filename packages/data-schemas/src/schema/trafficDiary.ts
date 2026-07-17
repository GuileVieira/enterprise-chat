import { Schema } from 'mongoose';
import type { ITrafficDiaryEntry } from '~/types/trafficDiary';

const ActorSchema = new Schema(
  {
    id: { type: String, required: true },
    name: String,
    email: String,
  },
  { _id: false },
);

const AnswerSchema = new Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    parentQuestionId: String,
  },
  { _id: false },
);

const EventSchema = new Schema(
  {
    type: { type: String, enum: ['created', 'updated', 'completed', 'reopened'], required: true },
    actor: { type: ActorSchema, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const trafficDiarySchema = new Schema<ITrafficDiaryEntry>(
  {
    projectId: { type: String, required: true, index: true },
    tenantId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    timeZone: String,
    weekStart: String,
    status: { type: String, enum: ['draft', 'completed'], default: 'draft', required: true },
    answers: { type: [AnswerSchema], default: [] },
    createdBy: { type: ActorSchema, required: true },
    lastEditedBy: ActorSchema,
    completedBy: ActorSchema,
    completedAt: Date,
    events: { type: [EventSchema], default: [] },
  },
  { timestamps: true },
);

trafficDiarySchema.index({ projectId: 1, userId: 1, date: 1 }, { unique: true });

export default trafficDiarySchema;
