
import mongoose, { Schema, Document } from 'mongoose';

export interface IEventLog extends Document {
  signature: string;
  slot: number;
  eventName: string;
  data: any;
  timestamp: Date;
}

const EventLogSchema: Schema = new Schema({
  signature: { type: String, required: true },
  slot: { type: Number, required: true },
  eventName: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Index for faster querying by event type and time
EventLogSchema.index({ eventName: 1, timestamp: -1 });

export default mongoose.models.EventLog || mongoose.model<IEventLog>('EventLog', EventLogSchema);
