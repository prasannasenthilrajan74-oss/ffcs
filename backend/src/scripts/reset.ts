/**
 * Development-only reset script.
 * Drops all applicants and resets department allocatedCount to 0.
 * Run: npm run reset
 * NEVER expose this as an HTTP endpoint in production.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Applicant } from '../models/Applicant';
import { Department } from '../models/Department';

async function reset() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Reset] This script cannot be run in production!');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[Reset] Connected to MongoDB');

  const deletedApplicants = await Applicant.deleteMany({});
  console.log(`[Reset] Deleted ${deletedApplicants.deletedCount} applicants`);

  const result = await Department.updateMany({}, { $set: { allocatedCount: 0 } });
  console.log(`[Reset] Reset allocatedCount for ${result.modifiedCount} departments`);

  console.log('[Reset] Done — all test data cleared');
  await mongoose.disconnect();
}

reset().catch((err) => {
  console.error('[Reset] Error:', err);
  process.exit(1);
});
