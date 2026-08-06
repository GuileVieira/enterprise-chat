import { Schema } from 'mongoose';
import type { IMeeting } from '~/types/meeting';

const UtteranceSchema = new Schema(
  {
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    confidence: { type: Number, min: 0, max: 1, default: null },
  },
  { _id: false },
);

const ParticipantSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 35 },
    source: {
      type: String,
      enum: ['manual', 'google_meet', 'zoom', 'teams'],
      required: true,
    },
    channel: { type: Number, min: 1, max: 32 },
  },
  { _id: false },
);

const SpeakerIdentificationSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    source: {
      type: String,
      enum: ['unidentified', 'assemblyai_participants', 'channel', 'manual'],
      required: true,
    },
    confidence: { type: Number, min: 0, max: 1, default: null },
    confirmed: { type: Boolean, required: true },
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
      enum: ['uploading', 'upload_failed', 'submitting', 'processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    duration: { type: Number, required: true },
    assemblyTranscriptId: { type: String, required: true, unique: true },
    mimeType: String,
    transcript: { type: String, default: '' },
    utterances: { type: [UtteranceSchema], default: [] },
    participants: { type: [ParticipantSchema], default: [] },
    multichannel: { type: Boolean, default: false },
    speakerNames: { type: Map, of: String, default: {} },
    speakerIdentifications: { type: Map, of: SpeakerIdentificationSchema, default: {} },
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
