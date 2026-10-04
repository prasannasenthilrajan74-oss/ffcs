import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import { allocate, DuplicateRegistrationError } from '../services/allocationEngine';
import { Applicant } from '../models/Applicant';
import { Department, DEPARTMENT_NAMES, DepartmentName } from '../models/Department';
import { FFCSMember } from '../models/FFCSMember';
import { getSetting } from '../models/Settings';

const router = Router();

// Rate limit: max 60 requests per minute per IP for public registration
const registrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 submissions per minute per IP (generous for genuine users)
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const validationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ max: 100 })
    .withMessage('Name too long'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .custom((value: string) => {
      if (!value.toLowerCase().endsWith('@vitstudent.ac.in')) {
        throw new Error('Only @vitstudent.ac.in email addresses are accepted');
      }
      return true;
    }),

  body('registrationNumber')
    .trim()
    .notEmpty()
    .withMessage('Registration number is required')
    .isLength({ min: 5, max: 20 })
    .withMessage('Invalid registration number'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),

  body('preferences')
    .isArray({ min: 3, max: 3 })
    .withMessage('Exactly 3 preferences required'),

  body('preferences.*')
    .isIn(DEPARTMENT_NAMES)
    .withMessage(`Invalid department. Must be one of: ${DEPARTMENT_NAMES.join(', ')}`),

  body('preferences').custom((preferences: string[]) => {
    if (new Set(preferences).size !== 3) {
      throw new Error('All 3 preferences must be different departments');
    }
    return true;
  }),
];

// ── GET /api/applications/verify-member ───────────────────────────────────────
router.get('/verify-member', async (req: Request, res: Response): Promise<void> => {
  try {
    const regNumber = ((req.query.regNumber as string) || '').trim().toUpperCase();
    if (!regNumber || regNumber.length < 5) {
      res.status(400).json({ valid: false, message: 'Registration number is required' });
      return;
    }

    const member = await FFCSMember.findOne({ registrationNumber: regNumber }).lean();
    if (!member) {
      res.json({
        valid: false,
        message: `Registration number "${regNumber}" was not found in the approved FFCS members roster. Only approved FFCS members can submit preferences.`,
      });
      return;
    }

    // Check if already registered
    const existing = await Applicant.findOne({
      $or: [
        { registrationNumber: regNumber },
        { email: member.email.toLowerCase() },
      ],
    }).lean();

    res.json({
      valid: true,
      alreadyRegistered: Boolean(existing),
      applicationNumber: existing?.applicationNumber,
      allocatedDepartment: existing?.allocatedDepartment,
      status: existing?.status,
      member: {
        registrationNumber: member.registrationNumber,
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        programme: member.programme,
        school: member.school,
      },
    });
  } catch (err) {
    console.error('[GET /api/applications/verify-member]', err);
    res.status(500).json({ valid: false, message: 'Failed to verify member' });
  }
});

// POST /api/applications
router.post(
  '/',
  registrationLimiter,
  validationRules,
  async (req: Request, res: Response): Promise<void> => {
    // Check if registration is open
    const isOpen = await getSetting<boolean>('registrationOpen', true);
    if (!isOpen) {
      res.status(403).json({
        error: 'Registration is currently closed. Please check back later.',
      });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const { name, email, registrationNumber, phone, preferences } = req.body as {
      name: string;
      email: string;
      registrationNumber: string;
      phone?: string;
      preferences: [DepartmentName, DepartmentName, DepartmentName];
    };

    // Strict validation against approved FFCS members roster
    const cleanReg = registrationNumber.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    const member = await FFCSMember.findOne({ registrationNumber: cleanReg });
    if (!member) {
      res.status(403).json({
        error: `Registration number "${cleanReg}" is not in the approved FFCS members roster. Only registered FFCS members can submit.`,
      });
      return;
    }

    if (member.email.toLowerCase().trim() !== cleanEmail) {
      res.status(422).json({
        errors: [
          {
            type: 'field',
            path: 'email',
            msg: `Email does not match the official FFCS roster email on file for ${cleanReg} (${member.email}).`,
          },
        ],
      });
      return;
    }

    try {
      // submittedAt is stamped server-side — NEVER from client
      const submittedAt = new Date();

      const result = await allocate({
        name,
        email,
        registrationNumber,
        phone,
        preferences,
        submittedAt,
      });

      res.status(201).json({
        success: true,
        applicationNumber: result.applicationNumber,
        status: result.status,
        allocatedDepartment: result.allocatedDepartment ?? null,
      });
    } catch (err) {
      if (err instanceof DuplicateRegistrationError) {
        res.status(409).json({
          error: 'You have already submitted your department preferences.',
          applicationNumber: err.applicationNumber,
          status: err.status,
          allocatedDepartment: err.allocatedDepartment,
        });
        return;
      }

      console.error('[POST /api/applications]', err);
      res.status(500).json({
        error: 'Something went wrong while submitting your application. Please try again.',
      });
    }
  }
);

// GET /api/applications/:applicationNumber
router.get(
  '/:applicationNumber',
  param('applicationNumber')
    .trim()
    .matches(/^VIT-\d{4}$/)
    .withMessage('Invalid application number format'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    try {
      const applicant = await Applicant.findOne({
        applicationNumber: req.params.applicationNumber,
      }).select('applicationNumber name status allocatedDepartment submittedAt');

      if (!applicant) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      res.json({
        applicationNumber: applicant.applicationNumber,
        name: applicant.name,
        status: applicant.status,
        allocatedDepartment: applicant.allocatedDepartment ?? null,
        submittedAt: applicant.submittedAt,
      });
    } catch (err) {
      console.error('[GET /api/applications/:id]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
