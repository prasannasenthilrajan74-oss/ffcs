import mongoose, { Document, Schema } from 'mongoose';

export const DEPARTMENT_NAMES = [
  'Outreach',
  'Creative',
  'Editorial',
  'Publicity',
  'Event Management',
  'Photography',
  'Editing',
  'Artistic',
] as const;

export type DepartmentName = (typeof DEPARTMENT_NAMES)[number];

export interface IDepartment extends Document {
  name: DepartmentName;
  capacity: number;
  allocatedCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: {
      type: String,
      enum: DEPARTMENT_NAMES,
      required: true,
      unique: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    allocatedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: remaining seats
DepartmentSchema.virtual('remaining').get(function (this: IDepartment) {
  return Math.max(0, this.capacity - this.allocatedCount);
});

DepartmentSchema.set('toJSON', { virtuals: true });
DepartmentSchema.set('toObject', { virtuals: true });

export const Department = mongoose.model<IDepartment>(
  'Department',
  DepartmentSchema
);
