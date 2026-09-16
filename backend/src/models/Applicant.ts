import mongoose, { Document, Schema } from 'mongoose';
import { DepartmentName } from './Department';

export type ApplicationStatus = 'CONFIRMED' | 'WAITLISTED';

export interface IApplicant extends Document {
  applicationNumber: string;
  name: string;
  email: string;
  registrationNumber: string;
  phone?: string;
  preferences: [DepartmentName, DepartmentName, DepartmentName];
  allocatedDepartment?: DepartmentName;
  status: ApplicationStatus;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>(
  {
    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 15,
    },
    preferences: {
      type: [String],
      required: true,
      validate: {
        validator: function (v: string[]) {
          return (
            v.length === 3 && new Set(v).size === 3
          );
        },
        message: 'Preferences must be exactly 3 distinct departments',
      },
    },
    allocatedDepartment: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['CONFIRMED', 'WAITLISTED'],
      required: true,
    },
    submittedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Applicant = mongoose.model<IApplicant>('Applicant', ApplicantSchema);
