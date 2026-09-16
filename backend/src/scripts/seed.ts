/**
 * Development-only seed script.
 * Creates departments with initial capacities.
 * Run: npm run seed
 * DO NOT expose this as an HTTP endpoint.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Department, DEPARTMENT_NAMES } from '../models/Department';
import { syncFFCSRoster } from '../services/ffcsRoster';

const INITIAL_CAPACITIES: Record<string, number> = {
  Outreach: 15,
  Creative: 20,
  Editorial: 15,
  Publicity: 15,
  'Event Management': 20,
  Photography: 15,
  Editing: 16,
  Projects: 15,
};

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[Seed] Connected to MongoDB');

  for (const name of DEPARTMENT_NAMES) {
    const capacity = INITIAL_CAPACITIES[name] ?? 15;
    const existing = await Department.findOne({ name });

    if (existing) {
      console.log(`[Seed] Department "${name}" already exists — skipping`);
      continue;
    }

    await Department.create({
      name,
      capacity,
      allocatedCount: 0,
      active: true,
    });
    console.log(`[Seed] Created department "${name}" with capacity ${capacity}`);
  }

  console.log('[Seed] Syncing FFCS members roster from Excel...');
  const memberCount = await syncFFCSRoster(true);
  console.log(`[Seed] Synced ${memberCount} FFCS members.`);

  console.log('[Seed] Done');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
