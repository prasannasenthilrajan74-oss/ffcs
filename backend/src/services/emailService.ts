import dotenv from 'dotenv';
dotenv.config();
import dns from 'node:dns';
import nodemailer from 'nodemailer';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore on older node runtimes
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!user || !pass) {
    return null;
  }

  return (nodemailer.createTransport as any)({
    host,
    port,
    secure,
    auth: { user, pass },
    family: 4, // Force IPv4 to prevent 20-30s IPv6 routing hangs on Render/cloud instances
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert issues on some hosts
    },
  });
}

const defaultFrom = () => {
  let from = process.env.EMAIL_FROM?.trim();
  // Strip accidental outer quotes if entered in dashboard
  if (from && ((from.startsWith('"') && from.endsWith('"')) || (from.startsWith("'") && from.endsWith("'")))) {
    from = from.slice(1, -1).trim();
  }
  return from || `VITSION Movie Makers <${process.env.SMTP_USER || 'no-reply@vitsion.com'}>`;
};

/**
 * Send 6-digit OTP email to applicant's official VIT email
 */
export async function sendOTPEmail(
  toEmail: string,
  studentName: string,
  otp: string
): Promise<boolean> {
  console.log(`[EmailService] Preparing OTP dispatch to: ${toEmail}`);

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[EmailService DEV] No SMTP credentials configured. Mock OTP for ${toEmail}: [ ${otp} ]`);
    return true;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0f11; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 540px; margin: 0 auto; background-color: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px 24px; text-align: center; }
        .logo { font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #ffffff; margin-bottom: 6px; }
        .logo span { color: #e63946; }
        .badge { display: inline-block; background-color: rgba(230, 57, 70, 0.15); color: #e63946; border: 1px solid rgba(230, 57, 70, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 24px; }
        .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #ffffff; }
        .text { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 24px; }
        .otp-box { background-color: #27272a; border: 2px dashed #e63946; border-radius: 8px; padding: 18px; margin: 0 auto 24px; max-width: 280px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; margin: 0; }
        .timer { font-size: 12px; color: #fbbf24; margin-top: 8px; font-weight: 500; }
        .warning { font-size: 12px; color: #71717a; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">VITSION <span>MOVIE MAKERS</span></div>
        <div class="badge">Recruitment 2026-27 • FFCS Verification</div>
        <div class="greeting">Hello ${studentName || 'Student'},</div>
        <div class="text">
          Use the 6-digit verification code below to verify your identity and submit your department preferences.
        </div>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div class="timer">⏱ Valid for 10 minutes</div>
        </div>
        <div class="text" style="font-size: 13px;">
          Do not share this code with anyone. If you did not initiate this request, someone may be attempting to register with your registration number.
        </div>
        <div class="warning">
          This is an automated email from VITSION Movie Makers Recruitment Portal.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: defaultFrom(),
      to: toEmail,
      subject: `Your VITSION Verification Code: ${otp}`,
      text: `Hello ${studentName},\n\nYour 6-digit verification code for VITSION Recruitment 2026-27 is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      html,
    });
    console.log(`[EmailService] OTP successfully sent to ${toEmail}`);
    return true;
  } catch (err: any) {
    console.error('[EmailService] Failed to send OTP email:', err);
    throw err;
  }
}

/**
 * Send official Allocation Confirmation email
 */
export async function sendAllocationConfirmationEmail(
  toEmail: string,
  data: {
    name: string;
    registrationNumber: string;
    applicationNumber: string;
    allocatedDepartment: string;
    preferences: string[];
    createdAt?: Date;
  }
): Promise<boolean> {
  console.log(`[EmailService] Sending Allocation Confirmation to ${toEmail}`);

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EmailService DEV] Mock Allocation Confirmation -> To: ${toEmail} | Dept: ${data.allocatedDepartment}`);
    return true;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0f11; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; background-color: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px 24px; }
        .logo { text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #ffffff; margin-bottom: 6px; }
        .logo span { color: #e63946; }
        .badge-wrap { text-align: center; margin-bottom: 24px; }
        .badge { display: inline-block; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .greeting { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #ffffff; text-align: center; }
        .text { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 24px; text-align: center; }
        .card { background-color: #27272a; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); padding: 20px; margin-bottom: 24px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
        .row:last-child { border-bottom: none; }
        .label { color: #71717a; font-weight: 500; }
        .val { color: #ffffff; font-weight: 600; text-align: right; }
        .allocated-badge { background-color: #e63946; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: 700; }
        .footer { font-size: 12px; color: #71717a; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">VITSION <span>MOVIE MAKERS</span></div>
        <div class="badge-wrap">
          <div class="badge">✓ Allocation Confirmed • Recruitment 2026-27</div>
        </div>
        <div class="greeting">Congratulations, ${data.name}!</div>
        <div class="text">
          Your FFCS department allocation for <strong>VITSION Movie Makers</strong> has been officially confirmed and registered in our database.
        </div>
        <div class="card">
          <div class="row">
            <span class="label">Application No</span>
            <span class="val" style="color: #60a5fa; font-family: monospace;">${data.applicationNumber}</span>
          </div>
          <div class="row">
            <span class="label">Registration No</span>
            <span class="val">${data.registrationNumber}</span>
          </div>
          <div class="row">
            <span class="label">Allocated Department</span>
            <span class="val"><span class="allocated-badge">${data.allocatedDepartment}</span></span>
          </div>
          <div class="row">
            <span class="label">Submitted Preferences</span>
            <span class="val">${data.preferences.join(' → ')}</span>
          </div>
          <div class="row">
            <span class="label">Timestamp</span>
            <span class="val">${(data.createdAt || new Date()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
          </div>
        </div>
        <div class="text" style="font-size: 13px;">
          Please save this email and your Application Number for future reference during orientation and project onboarding.
        </div>
        <div class="footer">
          VITSION Movie Makers — Vellore Institute of Technology<br/>
          This is an automated confirmation message.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: defaultFrom(),
      to: toEmail,
      subject: `🎉 VITSION Allocation Confirmed: ${data.allocatedDepartment} (${data.applicationNumber})`,
      text: `Congratulations ${data.name}!\n\nYour FFCS department allocation has been confirmed:\n- Application Number: ${data.applicationNumber}\n- Registration Number: ${data.registrationNumber}\n- Allocated Department: ${data.allocatedDepartment}\n- Preferences: ${data.preferences.join(', ')}\n\nWelcome to VITSION Movie Makers!`,
      html,
    });
    return true;
  } catch (err: any) {
    console.error('[EmailService] Failed to send confirmation email:', err.message);
    return false;
  }
}
