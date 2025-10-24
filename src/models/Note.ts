import mongoose, { Document, Schema } from 'mongoose';

export interface INote {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  isImmutable: boolean; // true when session time has passed
  createdAt: Date;
  updatedAt: Date;
}

export interface INoteDocument extends INote, Document {}

const NoteSchema = new Schema<INoteDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    isImmutable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one note per user per booking
NoteSchema.index({ bookingId: 1, userId: 1 }, { unique: true });

// Index for cleanup queries
NoteSchema.index({ createdAt: 1 });

// Index for immutability checks
NoteSchema.index({ isImmutable: 1 });

const Note = mongoose.model<INoteDocument>('Note', NoteSchema);

export default Note;
