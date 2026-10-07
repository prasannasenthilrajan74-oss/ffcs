import { IApplicant } from '../models/Applicant';

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape values containing comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

const HEADERS = [
  'Application Number',
  'Name',
  'Email',
  'Registration Number',
  'Phone',
  'Preference 1',
  'Preference 2',
  'Preference 3',
  'Allocated Department',
  'Status',
  'Submitted At',
];

function rowToCSV(applicant: Partial<IApplicant>): string {
  return [
    applicant.applicationNumber,
    applicant.name,
    applicant.email,
    applicant.registrationNumber,
    applicant.phone ?? '',
    applicant.preferences?.[0] ?? '',
    applicant.preferences?.[1] ?? '',
    applicant.preferences?.[2] ?? '',
    applicant.allocatedDepartment ?? '',
    applicant.status,
    formatDate(applicant.submittedAt),
  ]
    .map(escapeCSV)
    .join(',');
}

export async function generateCSV(
  applicants: Partial<IApplicant>[]
): Promise<string> {
  const lines = [HEADERS.join(','), ...applicants.map(rowToCSV)];
  return '\uFEFF' + lines.join('\r\n');
}

export async function generateDepartmentCSV(
  applicants: Partial<IApplicant>[],
  department: string
): Promise<string> {
  const filtered = applicants.filter(
    (a) => a.allocatedDepartment === department
  );
  const lines = [HEADERS.join(','), ...filtered.map(rowToCSV)];
  return '\uFEFF' + lines.join('\r\n');
}

export async function generateUnfilledMembersCSV(
  members: Array<{
    registrationNumber: string;
    name: string;
    email: string;
    phone?: string;
    programme?: string;
    school?: string;
  }>
): Promise<string> {
  const headers = ['Registration Number', 'Name', 'Email', 'Phone', 'Programme', 'School'];
  const lines = [
    headers.join(','),
    ...members.map((m) =>
      [m.registrationNumber, m.name, m.email, m.phone ?? '', m.programme ?? '', m.school ?? '']
        .map(escapeCSV)
        .join(',')
    ),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

