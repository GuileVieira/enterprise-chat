import { Schema } from 'mongoose';
import type { IMeeting } from '~/types/meeting';

const UtteranceSchema = new Schema(
  {
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false },
);

const meetingSchema = new Schema<IMeeting>(
  {
    projectId: { type: String, required: true, index: true },
    tenantId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    duration: { type: Number, required: true },
    assemblyTranscriptId: { type: String, required: true, unique: true },
    transcript: { type: String, default: '' },
    utterances: { type: [UtteranceSchema], default: [] },
    speakerNames: { type: Map, of: String, default: {} },
    insights: {
      summary: { type: String, default: '' },
      decisions: { type: [String], default: [] },
      nextSteps: { type: [String], default: [] },
      tasks: { type: [String], default: [] },
    },
    indexStatus: {
      type: String,
      enum: ['pending', 'indexed', 'failed'],
      default: 'pending',
      required: true,
    },
    indexError: String,
    indexedAt: Date,
    error: String,
    recordedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

meetingSchema.index({ projectId: 1, recordedAt: -1 });

export default meetingSchema;
