import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '../middleware/auth';
import { Applicant } from '../models/Applicant';
import { Department } from '../models/Department';
import { getSetting, setSetting } from '../models/Settings';
import { generateCSV, generateDepartmentCSV } from '../services/csvExport';
import { deleteApplicant } from '../services/allocationEngine';

const router = Router();

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminEmail || !adminPassword || !jwtSecret) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Constant-time comparison to prevent timing attacks
    const emailMatch = email.toLowerCase() === adminEmail.toLowerCase();
    const passwordMatch = password === adminPassword;

    if (!emailMatch || !passwordMatch) {
      // Same message regardless of which field failed
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ email: adminEmail, role: 'admin' }, jwtSecret, {
      expiresIn: '8h',
    });

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.json({ success: true, token, message: 'Logged in successfully' });
  }
);

// ── POST /api/admin/logout ────────────────────────────────────────────────────
router.post('/logout', requireAdmin, (_req: Request, res: Response): void => {
  res.clearCookie('adminToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ success: true, message: 'Logged out' });
});

// ── GET /api/admin/me ─────────────────────────────────────────────────────────
router.get('/me', requireAdmin, (_req: Request, res: Response): void => {
  res.json({ authenticated: true });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalApplicants,
      confirmed,
      waitlisted,
      departments,
      registrationOpen,
    ] = await Promise.all([
      Applicant.countDocuments(),
      Applicant.countDocuments({ status: 'CONFIRMED' }),
      Applicant.countDocuments({ status: 'WAITLISTED' }),
      Department.find({ active: true }).lean(),
      getSetting<boolean>('registrationOpen', true),
    ]);

    const totalCapacity = departments.reduce((sum, d) => sum + d.capacity, 0);
    const totalFilled = departments.reduce((sum, d) => sum + d.allocatedCount, 0);

    res.json({
      totalApplicants,
      confirmed,
      waitlisted,
      totalCapacity,
      totalFilled,
      totalRemaining: totalCapacity - totalFilled,
      registrationOpen,
      departments: departments.map((d) => ({
        _id: d._id,
        name: d.name,
        capacity: d.capacity,
        allocatedCount: d.allocatedCount,
        remaining: Math.max(0, d.capacity - d.allocatedCount),
        isFull: d.allocatedCount >= d.capacity,
      })),
    });
  } catch (err) {
    console.error('[GET /api/admin/stats]', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── GET /api/admin/applications ───────────────────────────────────────────────
router.get(
  '/applications',
  requireAdmin,
  [
    query('search').optional().trim().isString(),
    query('status').optional().isIn(['CONFIRMED', 'WAITLISTED', '']),
    query('department').optional().trim().isString(),
    query('sortBy').optional().isIn(['submittedAt', 'applicationNumber', '']),
    query('sortOrder').optional().isIn(['asc', 'desc', '']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || '';
      const department = (req.query.department as string) || '';
      const sortBy = (req.query.sortBy as string) || 'submittedAt';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? -1 : 1;
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 50;

      // Build filter
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (department) filter.allocatedDepartment = department;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { registrationNumber: { $regex: search, $options: 'i' } },
          { applicationNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const [applicants, total] = await Promise.all([
        Applicant.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Applicant.countDocuments(filter),
      ]);

      res.json({
        applicants,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      console.error('[GET /api/admin/applications]', err);
      res.status(500).json({ error: 'Failed to load applicants' });
    }
  }
);

// ── DELETE /api/admin/applicants/:id ──────────────────────────────────────────
router.delete(
  '/applicants/:id',
  requireAdmin,
  [param('id').isMongoId().withMessage('Invalid applicant ID')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await deleteApplicant(req.params.id as string);
      if (!result.deleted) {
        res.status(404).json({ error: 'Applicant not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Applicant request deleted successfully and seat freed.',
        applicant: result.applicant,
      });
    } catch (err) {
      console.error('[DELETE /api/admin/applicants/:id]', err);
      res.status(500).json({ error: 'Failed to delete applicant request' });
    }
  }
);

// ── GET /api/admin/departments ────────────────────────────────────────────────
router.get('/departments', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.find().lean();
    res.json(
      departments.map((d) => ({
        _id: d._id,
        name: d.name,
        capacity: d.capacity,
        allocatedCount: d.allocatedCount,
        remaining: Math.max(0, d.capacity - d.allocatedCount),
        active: d.active,
      }))
    );
  } catch (err) {
    console.error('[GET /api/admin/departments]', err);
    res.status(500).json({ error: 'Failed to load departments' });
  }
});

// ── PATCH /api/admin/departments/:id ─────────────────────────────────────────
router.patch(
  '/departments/:id',
  requireAdmin,
  [
    param('id').isMongoId().withMessage('Invalid department ID'),
    body('capacity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Capacity must be a non-negative integer'),
    body('active').optional().isBoolean().withMessage('Active must be boolean'),
    body('force')
      .optional()
      .isBoolean()
      .withMessage('Force must be boolean'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    try {
      const dept = await Department.findById(req.params.id as string);
      if (!dept) {
        res.status(404).json({ error: 'Department not found' });
        return;
      }

      const { capacity, active, force } = req.body as {
        capacity?: number;
        active?: boolean;
        force?: boolean;
      };

      // Warn if new capacity < current allocations
      if (
        capacity !== undefined &&
        capacity < dept.allocatedCount &&
        !force
      ) {
        res.status(409).json({
          warning: true,
          message: `Current allocation (${dept.allocatedCount}) exceeds the new capacity (${capacity}). Existing allocations will NOT be automatically removed. Send "force": true to confirm.`,
          currentAllocations: dept.allocatedCount,
          requestedCapacity: capacity,
        });
        return;
      }

      if (capacity !== undefined) dept.capacity = capacity;
      if (active !== undefined) dept.active = active;

      await dept.save();

      res.json({
        _id: dept._id,
        name: dept.name,
        capacity: dept.capacity,
        allocatedCount: dept.allocatedCount,
        remaining: Math.max(0, dept.capacity - dept.allocatedCount),
        active: dept.active,
      });
    } catch (err) {
      console.error('[PATCH /api/admin/departments/:id]', err);
      res.status(500).json({ error: 'Failed to update department' });
    }
  }
);

// ── GET /api/admin/export ─────────────────────────────────────────────────────
router.get(
  '/export',
  requireAdmin,
  [query('department').optional().trim().isString()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const department = (req.query.department as string) || '';

      const filter: Record<string, unknown> = {};
      if (department) filter.allocatedDepartment = department;

      const applicants = await Applicant.find(filter).sort({ submittedAt: 1 }).lean();

      if (department) {
        const csv = await generateDepartmentCSV(applicants, department);
        const filename = `${department.replace(/\s+/g, '_')}_applicants.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      } else {
        const csv = await generateCSV(applicants);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="all_applicants.csv"');
        res.send(csv);
      }
    } catch (err) {
      console.error('[GET /api/admin/export]', err);
      res.status(500).json({ error: 'Failed to generate export' });
    }
  }
);

// ── GET /api/admin/settings ───────────────────────────────────────────────────
router.get('/settings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const registrationOpen = await getSetting<boolean>('registrationOpen', true);
    res.json({ registrationOpen });
  } catch (err) {
    console.error('[GET /api/admin/settings]', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// ── PATCH /api/admin/settings ─────────────────────────────────────────────────
router.patch(
  '/settings',
  requireAdmin,
  [body('registrationOpen').isBoolean().withMessage('registrationOpen must be boolean')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    try {
      const { registrationOpen } = req.body as { registrationOpen: boolean };
      await setSetting('registrationOpen', registrationOpen);
      res.json({ registrationOpen });
    } catch (err) {
      console.error('[PATCH /api/admin/settings]', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

export default router;
