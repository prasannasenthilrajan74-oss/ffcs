import * as xlsx from 'xlsx';
import { IApplicant } from '../models/Applicant';
import { DEPARTMENT_NAMES } from '../models/Department';

function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function applicantToRow(applicant: Partial<IApplicant>) {
  return {
    'Application Number': applicant.applicationNumber ?? '',
    'Name': applicant.name ?? '',
    'Email': applicant.email ?? '',
    'Registration Number': applicant.registrationNumber ?? '',
    'Phone': applicant.phone ?? '',
    'Preference 1': applicant.preferences?.[0] ?? '',
    'Preference 2': applicant.preferences?.[1] ?? '',
    'Preference 3': applicant.preferences?.[2] ?? '',
    'Allocated Department': applicant.allocatedDepartment ?? 'N/A',
    'Status': applicant.status ?? '',
    'Submitted At': formatDate(applicant.submittedAt),
  };
}

const COL_WIDTHS = [
  { wch: 22 }, // Application Number
  { wch: 26 }, // Name
  { wch: 32 }, // Email
  { wch: 22 }, // Registration Number
  { wch: 16 }, // Phone
  { wch: 20 }, // Preference 1
  { wch: 20 }, // Preference 2
  { wch: 20 }, // Preference 3
  { wch: 24 }, // Allocated Department
  { wch: 15 }, // Status
  { wch: 22 }, // Submitted At
];

export async function generateExcel(
  applicants: Partial<IApplicant>[]
): Promise<Buffer> {
  const workbook = xlsx.utils.book_new();

  // 1. All applicants sheet
  const allRows = applicants.map(applicantToRow);
  const allWorksheet = xlsx.utils.json_to_sheet(allRows);
  allWorksheet['!cols'] = COL_WIDTHS;
  xlsx.utils.book_append_sheet(workbook, allWorksheet, 'All Applicants');

  // 2. Department-wise sheets for quick filtering in Excel
  for (const dept of DEPARTMENT_NAMES) {
    const deptRows = applicants
      .filter((a) => a.allocatedDepartment === dept)
      .map(applicantToRow);
    if (deptRows.length > 0) {
      const deptSheet = xlsx.utils.json_to_sheet(deptRows);
      deptSheet['!cols'] = COL_WIDTHS;
      // Sheet names in Excel cannot exceed 31 characters
      xlsx.utils.book_append_sheet(workbook, deptSheet, dept.slice(0, 31));
    }
  }

  // 3. Waitlisted sheet (if any)
  const waitlistedRows = applicants
    .filter((a) => a.status === 'WAITLISTED')
    .map(applicantToRow);
  if (waitlistedRows.length > 0) {
    const waitlistSheet = xlsx.utils.json_to_sheet(waitlistedRows);
    waitlistSheet['!cols'] = COL_WIDTHS;
    xlsx.utils.book_append_sheet(workbook, waitlistSheet, 'Waitlisted');
  }

  const output = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

export async function generateDepartmentExcel(
  applicants: Partial<IApplicant>[],
  department: string
): Promise<Buffer> {
  const workbook = xlsx.utils.book_new();

  const filtered = applicants.filter(
    (a) => a.allocatedDepartment === department
  );
  const rows = filtered.map(applicantToRow);
  const worksheet = xlsx.utils.json_to_sheet(rows);
  worksheet['!cols'] = COL_WIDTHS;

  const sheetName = department.slice(0, 31);
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

  const output = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

export async function generateUnfilledMembersExcel(
  members: Array<{
    registrationNumber: string;
    name: string;
    email: string;
    phone?: string;
    programme?: string;
    school?: string;
  }>
): Promise<Buffer> {
  const workbook = xlsx.utils.book_new();
  const rows = members.map((m) => ({
    'Registration Number': m.registrationNumber,
    'Name': m.name,
    'Email': m.email,
    'Phone': m.phone || '',
    'Programme': m.programme || '',
    'School': m.school || '',
  }));
  const worksheet = xlsx.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 26 },
    { wch: 32 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
  ];
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Pending Members');

  const output = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

