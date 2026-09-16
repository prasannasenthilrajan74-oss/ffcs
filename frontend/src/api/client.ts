import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // needed for httpOnly cookie auth
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vitsion_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type DepartmentName =
  | 'Outreach'
  | 'Creative'
  | 'Editorial'
  | 'Publicity'
  | 'Event Management'
  | 'Photography'
  | 'Editing'
  | 'Projects';

export const ALL_DEPARTMENTS: DepartmentName[] = [
  'Outreach',
  'Creative',
  'Editorial',
  'Publicity',
  'Event Management',
  'Photography',
  'Editing',
  'Projects',
];

export type ApplicationStatus = 'CONFIRMED' | 'WAITLISTED';

export interface RegistrationPayload {
  name: string;
  email: string;
  registrationNumber: string;
  phone?: string;
  preferences: [DepartmentName, DepartmentName, DepartmentName];
}

export interface RegistrationResult {
  success: boolean;
  applicationNumber: string;
  status: ApplicationStatus;
  allocatedDepartment: DepartmentName | null;
}

export interface DuplicateError {
  error: string;
  applicationNumber: string;
  status: ApplicationStatus;
  allocatedDepartment: DepartmentName | null;
}

export interface Department {
  _id: string;
  name: DepartmentName;
  capacity: number;
  allocatedCount: number;
  remaining: number;
  isFull: boolean;
  active?: boolean;
}

export interface Applicant {
  _id: string;
  applicationNumber: string;
  name: string;
  email: string;
  registrationNumber: string;
  phone?: string;
  preferences: [DepartmentName, DepartmentName, DepartmentName];
  allocatedDepartment: DepartmentName | null;
  status: ApplicationStatus;
  submittedAt: string;
  createdAt: string;
}

export interface AdminStats {
  totalApplicants: number;
  confirmed: number;
  waitlisted: number;
  totalCapacity: number;
  totalFilled: number;
  totalRemaining: number;
  registrationOpen: boolean;
  departments: Department[];
}

// ── Public APIs ───────────────────────────────────────────────────────────────

export async function submitApplication(
  payload: RegistrationPayload
): Promise<RegistrationResult> {
  const res = await api.post<RegistrationResult>('/api/applications', payload);
  return res.data;
}

export async function getApplicationByNumber(
  applicationNumber: string
): Promise<{ applicationNumber: string; name: string; status: ApplicationStatus; allocatedDepartment: DepartmentName | null }> {
  const res = await api.get(`/api/applications/${applicationNumber}`);
  return res.data;
}

export async function getPublicDepartments(): Promise<Department[]> {
  const res = await api.get<Department[]>('/api/departments');
  return res.data;
}

// ── Admin APIs ────────────────────────────────────────────────────────────────

export async function adminLogin(
  email: string,
  password: string
): Promise<void> {
  const res = await api.post<{ success: boolean; token?: string }>('/api/admin/login', {
    email,
    password,
  });
  if (res.data?.token) {
    localStorage.setItem('vitsion_admin_token', res.data.token);
  }
}

export async function adminLogout(): Promise<void> {
  localStorage.removeItem('vitsion_admin_token');
  await api.post('/api/admin/logout');
}

export async function checkAdminAuth(): Promise<boolean> {
  try {
    await api.get('/api/admin/me');
    return true;
  } catch {
    return false;
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await api.get<AdminStats>('/api/admin/stats');
  return res.data;
}

export async function getAdminApplications(params: {
  search?: string;
  status?: string;
  department?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}): Promise<{ applicants: Applicant[]; total: number; page: number; totalPages: number }> {
  const res = await api.get('/api/admin/applications', { params });
  return res.data;
}

export async function getAdminDepartments(): Promise<Department[]> {
  const res = await api.get<Department[]>('/api/admin/departments');
  return res.data;
}

export async function updateDepartment(
  id: string,
  updates: { capacity?: number; active?: boolean; force?: boolean }
): Promise<Department> {
  const res = await api.patch<Department>(`/api/admin/departments/${id}`, updates);
  return res.data;
}

export async function getAdminSettings(): Promise<{ registrationOpen: boolean }> {
  const res = await api.get('/api/admin/settings');
  return res.data;
}

export async function updateSettings(settings: {
  registrationOpen: boolean;
}): Promise<{ registrationOpen: boolean }> {
  const res = await api.patch('/api/admin/settings', settings);
  return res.data;
}

export function getExportUrl(department?: string): string {
  const base = `${API_BASE}/api/admin/export`;
  const token = localStorage.getItem('vitsion_admin_token');
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (token) params.set('token', token);
  return `${base}${params.toString() ? '?' + params.toString() : ''}`;
}

export interface VerifyMemberResult {
  valid: boolean;
  alreadyRegistered?: boolean;
  applicationNumber?: string;
  allocatedDepartment?: DepartmentName | null;
  status?: ApplicationStatus;
  message?: string;
  member?: {
    registrationNumber: string;
    name: string;
    email: string;
    phone?: string;
    programme?: string;
    school?: string;
  };
}

export async function verifyFFCSMember(regNumber: string): Promise<VerifyMemberResult> {
  const res = await api.get<VerifyMemberResult>('/api/applications/verify-member', {
    params: { regNumber: regNumber.trim().toUpperCase() },
  });
  return res.data;
}

export async function deleteAdminApplication(
  id: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.delete<{ success: boolean; message: string }>(
    `/api/admin/applicants/${id}`
  );
  return res.data;
}

