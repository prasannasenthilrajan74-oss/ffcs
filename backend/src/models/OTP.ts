import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  registrationNumber: string;
  email: string;
  otp: string;
  attempts: number;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>(
  {
    registrationNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // MongoDB TTL: automatically deleted after 10 minutes (600 seconds)
    },
  },
  {
    timestamps: false,
  }
);

// Index to quickly look up OTP for a member
otpSchema.index({ registrationNumber: 1, email: 1 });

export const OTP = mongoose.model<IOTP>('OTP', otpSchema);
