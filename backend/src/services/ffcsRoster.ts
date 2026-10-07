import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import { FFCSMember, IFFCSMember } from '../models/FFCSMember';
import { Applicant } from '../models/Applicant';

interface ExcelMemberRow {
  'Register No'?: string | number;
  Name?: string;
  Email?: string;
  'Mob No'?: string | number;
  Programme?: string;
  School?: string;
  [key: string]: unknown;
}

/**
 * Locate the FFCS Excel file (checking backend/data or workspace root).
 */
export function getExcelFilePath(): string | null {
  const possiblePaths = [
    path.resolve(__dirname, '..', '..', 'data', 'ffcs_members.xlsx'),
    path.resolve(__dirname, '..', '..', '..', "all ffcs members '26-27.xlsx"),
    path.resolve(process.cwd(), 'data', 'ffcs_members.xlsx'),
    path.resolve(process.cwd(), "all ffcs members '26-27.xlsx"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Reads the Excel workbook and parses the member records.
 */
export function loadMembersFromExcel(): Array<{
  registrationNumber: string;
  name: string;
  email: string;
  phone?: string;
  programme?: string;
  school?: string;
}> {
  const filePath = getExcelFilePath();
  if (!filePath) {
    console.warn('[FFCS Roster] Excel file not found in search paths.');
    return [];
  }

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<ExcelMemberRow>(sheet);

  const members: Array<{
    registrationNumber: string;
    name: string;
    email: string;
    phone?: string;
    programme?: string;
    school?: string;
  }> = [];

  for (const r of rows) {
    const regNoRaw = r['Register No'];
    if (!regNoRaw) continue;

    const registrationNumber = String(regNoRaw).trim().toUpperCase();
    const name = String(r.Name || '').trim();
    const email = String(r.Email || '').trim().toLowerCase();
    const phone = r['Mob No'] ? String(r['Mob No']).trim() : undefined;
    const programme = r.Programme ? String(r.Programme).trim() : undefined;
    const school = r.School ? String(r.School).trim() : undefined;

    if (registrationNumber && name && email) {
      members.push({
        registrationNumber,
        name,
        email,
        phone,
        programme,
        school,
      });
    }
  }

  return members;
}

/**
 * Seed or update FFCS members in MongoDB.
 */
export async function syncFFCSRoster(force = false): Promise<number> {
  const existingCount = await FFCSMember.countDocuments();
  if (existingCount > 0 && !force) {
    return existingCount;
  }

  const members = loadMembersFromExcel();
  if (members.length === 0) {
    console.warn('[FFCS Roster] No members found to sync from Excel.');
    return 0;
  }

  const bulkOps = members.map((m) => ({
    updateOne: {
      filter: { registrationNumber: m.registrationNumber },
      update: { $set: m },
      upsert: true,
    },
  }));

  await FFCSMember.bulkWrite(bulkOps);
  const total = await FFCSMember.countDocuments();
  console.log(`[FFCS Roster] Successfully synced ${total} members into database.`);
  return total;
}

/**
 * Check if a student is an approved FFCS member.
 */
export async function findFFCSMember(
  registrationNumber: string
): Promise<IFFCSMember | null> {
  const cleanReg = registrationNumber.trim().toUpperCase();
  return FFCSMember.findOne({ registrationNumber: cleanReg });
}

export interface UnfilledMember {
  registrationNumber: string;
  name: string;
  email: string;
  phone?: string;
  programme?: string;
  school?: string;
}

export interface RosterCompletionStatus {
  totalRoster: number;
  filledCount: number;
  unfilledCount: number;
  unfilledMembers: UnfilledMember[];
}

/**
 * Computes how many approved FFCS roster members have and have not
 * submitted their department preferences, purely by reading from DB (or Excel fallback).
 * This operation is strictly read-only and does NOT write or manipulate the database.
 */
export async function getRosterCompletionStatus(): Promise<RosterCompletionStatus> {
  let members: Array<{
    registrationNumber: string;
    name: string;
    email: string;
    phone?: string;
    programme?: string;
    school?: string;
  }> = await FFCSMember.find()
    .sort({ registrationNumber: 1 })
    .select('registrationNumber name email phone programme school')
    .lean();

  if (!members || members.length === 0) {
    members = loadMembersFromExcel();
  }

  const applicants = await Applicant.find({}, { registrationNumber: 1, email: 1 }).lean();
  const appliedRegSet = new Set(
    applicants.map((a) => (a.registrationNumber || '').trim().toUpperCase())
  );
  const appliedEmailSet = new Set(
    applicants.map((a) => (a.email || '').trim().toLowerCase())
  );

  const unfilledMembers: UnfilledMember[] = [];
  let filledCount = 0;

  for (const m of members) {
    const reg = (m.registrationNumber || '').trim().toUpperCase();
    const email = (m.email || '').trim().toLowerCase();
    const hasApplied =
      (Boolean(reg) && appliedRegSet.has(reg)) ||
      (Boolean(email) && appliedEmailSet.has(email));

    if (hasApplied) {
      filledCount++;
    } else {
      unfilledMembers.push({
        registrationNumber: m.registrationNumber,
        name: m.name,
        email: m.email,
        phone: m.phone || '',
        programme: m.programme || '',
        school: m.school || '',
      });
    }
  }

  return {
    totalRoster: members.length,
    filledCount,
    unfilledCount: unfilledMembers.length,
    unfilledMembers,
  };
}

