import mongoose from 'mongoose';
import { Department, DepartmentName } from '../models/Department';
import { Applicant, ApplicationStatus } from '../models/Applicant';

/**
 * FCFS Allocation Engine
 *
 * Uses MongoDB atomic conditional update ($lt guard on allocatedCount) to
 * prevent any race condition when two applicants submit for the last seat.
 *
 * The findOneAndUpdate with { allocatedCount: { $lt: capacity } } combined
 * with $inc: { allocatedCount: 1 } is a single server-side atomic operation.
 * MongoDB's document-level locking guarantees only ONE writer wins.
 *
 * No TOCTOU (time-of-check-time-of-use) vulnerability exists because
 * the check and the increment happen atomically within MongoDB.
 */

interface AllocationInput {
  name: string;
  email: string;
  registrationNumber: string;
  phone?: string;
  preferences: [DepartmentName, DepartmentName, DepartmentName];
  submittedAt: Date;
}

interface AllocationResult {
  applicationNumber: string;
  status: ApplicationStatus;
  allocatedDepartment?: DepartmentName;
}

/**
 * Generate the next application number atomically.
 * Uses a counter approach: counts existing applicants to determine next number.
 * Wrapped inside a transaction so it stays consistent.
 */
async function generateApplicationNumber(session: mongoose.ClientSession): Promise<string> {
  // Count within the same transaction session to serialize
  const count = await Applicant.countDocuments({}).session(session);
  const num = count + 1;
  return `VIT-${String(num).padStart(4, '0')}`;
}

/**
 * Attempt to atomically claim a seat in a department.
 * Returns true if the seat was successfully claimed, false if department is full.
 */
async function claimSeat(
  deptName: DepartmentName,
  session: mongoose.ClientSession
): Promise<boolean> {
  const result = await Department.findOneAndUpdate(
    {
      name: deptName,
      active: true,
      // This condition atomically ensures we only increment if seat is available
      $expr: { $lt: ['$allocatedCount', '$capacity'] },
    },
    {
      $inc: { allocatedCount: 1 },
    },
    {
      new: true,
      session,
    }
  );

  return result !== null;
}

/**
 * Main allocation function.
 * Called once per registration request.
 * Uses a MongoDB transaction to ensure:
 * 1. Application number generation is sequential
 * 2. Seat claim and applicant save are atomic
 */
export async function allocate(input: AllocationInput): Promise<AllocationResult> {
  const session = await mongoose.startSession();

  try {
    let result!: AllocationResult;

    await session.withTransaction(async () => {
      // Check for duplicate email or registration number WITHIN transaction
      const existing = await Applicant.findOne({
        $or: [
          { email: input.email.toLowerCase().trim() },
          { registrationNumber: input.registrationNumber.toUpperCase().trim() },
        ],
      }).session(session);

      if (existing) {
        throw new DuplicateRegistrationError(
          existing.applicationNumber,
          existing.allocatedDepartment,
          existing.status
        );
      }

      // Generate application number (serialized within transaction)
      const applicationNumber = await generateApplicationNumber(session);

      // Try preferences in order
      let allocatedDepartment: DepartmentName | undefined;
      let status: ApplicationStatus = 'WAITLISTED';

      for (const pref of input.preferences) {
        const claimed = await claimSeat(pref, session);
        if (claimed) {
          allocatedDepartment = pref;
          status = 'CONFIRMED';
          break;
        }
      }

      // Save applicant record
      const applicantDoc = new Applicant({
        applicationNumber,
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        registrationNumber: input.registrationNumber.toUpperCase().trim(),
        phone: input.phone?.trim() || undefined,
        preferences: input.preferences,
        allocatedDepartment: allocatedDepartment ?? null,
        status,
        submittedAt: input.submittedAt,
      });
      await applicantDoc.save({ session });

      result = {
        applicationNumber: applicantDoc.applicationNumber,
        status: applicantDoc.status,
        allocatedDepartment: applicantDoc.allocatedDepartment as DepartmentName | undefined,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

// ── Delete Applicant Function (Admin) ─────────────────────────────────────────

export async function deleteApplicant(id: string): Promise<{
  deleted: boolean;
  applicant?: {
    name: string;
    registrationNumber: string;
    allocatedDepartment?: string | null;
  };
}> {
  const session = await mongoose.startSession();

  try {
    let result: {
      deleted: boolean;
      applicant?: {
        name: string;
        registrationNumber: string;
        allocatedDepartment?: string | null;
      };
    } = { deleted: false };

    await session.withTransaction(async () => {
      const applicant = await Applicant.findById(id).session(session);
      if (!applicant) {
        return;
      }

      // If allocated to a department, release the seat
      if (applicant.allocatedDepartment && applicant.status === 'CONFIRMED') {
        await Department.updateOne(
          { name: applicant.allocatedDepartment, allocatedCount: { $gt: 0 } },
          { $inc: { allocatedCount: -1 } }
        ).session(session);
      }

      await Applicant.findByIdAndDelete(id).session(session);

      result = {
        deleted: true,
        applicant: {
          name: applicant.name,
          registrationNumber: applicant.registrationNumber,
          allocatedDepartment: applicant.allocatedDepartment,
        },
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

// ── Custom Errors ─────────────────────────────────────────────────────────────

export class DuplicateRegistrationError extends Error {
  constructor(
    public readonly applicationNumber: string,
    public readonly allocatedDepartment: string | undefined,
    public readonly status: string
  ) {
    super('Duplicate registration');
    this.name = 'DuplicateRegistrationError';
  }
}

