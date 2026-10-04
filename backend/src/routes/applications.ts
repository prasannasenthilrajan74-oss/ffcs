import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import { allocate, DuplicateRegistrationError } from '../services/allocationEngine';
import { Applicant } from '../models/Applicant';
import { DEPARTMENT_NAMES, DepartmentName } from '../models/Department';
import { FFCSMember } from '../models/FFCSMember';
import { OTP } from '../models/OTP';
import { getSetting } from '../models/Settings';
import { sendOTPEmail, sendAllocationConfirmationEmail } from '../services/emailService';

const router = Router();

// Rate limit: max 5 submissions per minute per IP
const registrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit OTP requests: max 8 requests per 10 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: 'Too many OTP requests. Please wait a few minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Mask email for privacy: e.g. prasanna.s2024@vitstudent.ac.in -> pr****24@vitstudent.ac.in
 */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  if (user.length <= 4) {
    return `${user.charAt(0)}***@${domain}`;
  }
  return `${user.slice(0, 2)}****${user.slice(-2)}@${domain}`;
}

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

  body('otp')
    .trim()
    .notEmpty()
    .withMessage('Verification code (OTP) is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),

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
        maskedEmail: maskEmail(member.email),
        programme: member.programme,
        school: member.school,
      },
    });
  } catch (err) {
    console.error('[GET /api/applications/verify-member]', err);
    res.status(500).json({ valid: false, message: 'Failed to verify member' });
  }
});

// ── POST /api/applications/send-otp ───────────────────────────────────────────
router.post(
  '/send-otp',
  otpLimiter,
  body('registrationNumber')
    .trim()
    .notEmpty()
    .withMessage('Registration number is required'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const cleanReg = ((req.body.registrationNumber as string) || '').trim().toUpperCase();

    // Check if registration is open
    const isOpen = await getSetting<boolean>('registrationOpen', true);
    if (!isOpen) {
      res.status(403).json({ error: 'Registration is currently closed.' });
      return;
    }

    try {
      // Find student in approved roster
      const member = await FFCSMember.findOne({ registrationNumber: cleanReg });
      if (!member) {
        res.status(404).json({
          error: `Registration number "${cleanReg}" was not found in the approved FFCS members roster.`,
        });
        return;
      }

      // Check if already registered in Applicant collection
      const existing = await Applicant.findOne({
        $or: [
          { registrationNumber: cleanReg },
          { email: member.email.toLowerCase().trim() },
        ],
      });
      if (existing) {
        res.status(409).json({
          error: 'You have already submitted your preferences and received an allocation.',
          applicationNumber: existing.applicationNumber,
        });
        return;
      }

      // Generate 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Clean up previous OTPs for this registration number
      await OTP.deleteMany({ registrationNumber: cleanReg });

      // Save new OTP with 10-min TTL
      await OTP.create({
        registrationNumber: cleanReg,
        email: member.email.toLowerCase().trim(),
        otp,
        attempts: 0,
      });

      // Dispatch OTP email
      await sendOTPEmail(member.email, member.name, otp);

      res.json({
        success: true,
        message: 'Verification code sent successfully to your VIT email',
        maskedEmail: maskEmail(member.email),
      });
    } catch (err: any) {
      console.error('[POST /api/applications/send-otp]', err);
      res.status(500).json({
        error: 'Failed to send verification code. Please check your network or try again shortly.',
      });
    }
  }
);

// ── POST /api/applications ────────────────────────────────────────────────────
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

    const { name, email, registrationNumber, phone, preferences, otp } = req.body as {
      name: string;
      email: string;
      registrationNumber: string;
      phone?: string;
      preferences: [DepartmentName, DepartmentName, DepartmentName];
      otp: string;
    };

    const cleanReg = registrationNumber.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Strict validation against approved FFCS members roster
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

    // 2. Strict OTP verification
    const otpRecord = await OTP.findOne({
      registrationNumber: cleanReg,
      email: cleanEmail,
    });

    if (!otpRecord) {
      res.status(400).json({
        error: 'No active verification code found. Please request a new verification code.',
      });
      return;
    }

    const inputOtp = (otp || '').trim();
    if (otpRecord.otp !== inputOtp) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      if (otpRecord.attempts >= 3) {
        await OTP.deleteOne({ _id: otpRecord._id });
        res.status(400).json({
          error: 'Too many incorrect attempts. Your verification code has expired. Please request a new code.',
        });
        return;
      }
      await otpRecord.save();
      res.status(400).json({
        error: `Invalid verification code. You have ${3 - otpRecord.attempts} attempt(s) remaining.`,
      });
      return;
    }

    // OTP is valid — delete immediately to prevent reuse
    await OTP.deleteOne({ _id: otpRecord._id });

    try {
      // submittedAt is stamped server-side — NEVER from client
      const submittedAt = new Date();

      const result = await allocate({
        name,
        email: cleanEmail,
        registrationNumber: cleanReg,
        phone: phone || member.phone,
        preferences,
        submittedAt,
      });

      // 3. Asynchronously dispatch allocation confirmation email ("approve the message")
      sendAllocationConfirmationEmail(member.email, {
        name: member.name || name,
        registrationNumber: cleanReg,
        applicationNumber: result.applicationNumber,
        allocatedDepartment: result.allocatedDepartment || 'Pending Waitlist',
        preferences,
        createdAt: submittedAt,
      }).catch((emailErr) => {
        console.error('[POST /api/applications] Confirmation email failed:', emailErr.message);
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

// ── GET /api/applications/:applicationNumber ──────────────────────────────────
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
