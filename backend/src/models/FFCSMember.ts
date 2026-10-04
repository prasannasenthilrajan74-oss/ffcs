import mongoose, { Document, Schema } from 'mongoose';

export interface IFFCSMember extends Document {
  registrationNumber: string;
  name: string;
  email: string;
  phone?: string;
  programme?: string;
  school?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FFCSMemberSchema = new Schema<IFFCSMember>(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    programme: {
      type: String,
      trim: true,
    },
    school: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FFCSMember = mongoose.model<IFFCSMember>('FFCSMember', FFCSMemberSchema);
