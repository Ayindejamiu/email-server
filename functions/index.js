const { onValueWritten } = require('firebase-functions/v2/database');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { Resend } = require('resend');

const resendApiKey = defineSecret('RESEND_API_KEY');

// ── Brand constants ──────────────────────────────────────────────────────────
const BRAND_GREEN  = '#006633';
const BRAND_LIGHT  = '#e8f5ee';
const FROM_EMAIL   = 'NIEE Secretariat <secretary@niee.org.ng>';
const PORTAL_URL   = 'https://nieeportal.web.app/portal/login.html';
const CONTACT_EMAIL = 'secretary@niee.org.ng';
const CONTACT_PHONE = '+234 (0) 000 000 0000';

// ── Shared email wrapper ─────────────────────────────────────────────────────
function wrapLayout(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NIEE Membership</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_GREEN};padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;margin-bottom:12px;">🌿</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                Nigerian Institution of Environmental Engineers
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.82);font-size:13px;letter-spacing:1px;text-transform:uppercase;">
                Member Portal Notification
              </p>
            </td>
          </tr>

          <!-- Body -->
          ${bodyHtml}

          <!-- Footer -->
          <tr>
            <td style="background:#1a1a1a;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 6px;color:#aaaaaa;font-size:12px;">
                Nigerian Institution of Environmental Engineers (NIEE)
              </p>
              <p style="margin:0 0 6px;color:#888888;font-size:12px;">
                <a href="mailto:${CONTACT_EMAIL}" style="color:#66bb88;text-decoration:none;">${CONTACT_EMAIL}</a>
                &nbsp;&middot;&nbsp; ${CONTACT_PHONE}
              </p>
              <p style="margin:12px 0 0;color:#555555;font-size:11px;">
                This is an automated message from the NIEE Member Portal. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Status badge HTML ────────────────────────────────────────────────────────
function statusBadge(label, color, bg) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:13px;font-weight:700;
    padding:5px 18px;border-radius:20px;letter-spacing:0.4px;">${label}</span>`;
}

// ── Info row inside a card ───────────────────────────────────────────────────
function infoRow(label, value) {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #eef0ee;color:#777777;font-size:13px;width:160px;">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid #eef0ee;color:#1a1a1a;font-size:13px;font-weight:600;">${value || '—'}</td>
  </tr>`;
}

// ── CTA button ───────────────────────────────────────────────────────────────
function ctaButton(label) {
  return `<a href="${PORTAL_URL}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;
    font-size:14px;font-weight:700;padding:13px 36px;border-radius:6px;text-decoration:none;
    letter-spacing:0.3px;margin-top:8px;">${label}</a>`;
}

// ── Step indicator ───────────────────────────────────────────────────────────
function stepRow(num, label, done) {
  const dot = done
    ? `<td style="width:28px;vertical-align:middle;"><div style="width:24px;height:24px;border-radius:50%;
        background:${BRAND_GREEN};color:#fff;text-align:center;line-height:24px;font-size:12px;font-weight:700;">${num}</div></td>`
    : `<td style="width:28px;vertical-align:middle;"><div style="width:24px;height:24px;border-radius:50%;
        background:#e0e0e0;color:#999;text-align:center;line-height:24px;font-size:12px;font-weight:700;">${num}</div></td>`;
  const text = done
    ? `<td style="padding-left:12px;font-size:13px;color:#1a1a1a;font-weight:600;">${label}</td>`
    : `<td style="padding-left:12px;font-size:13px;color:#aaaaaa;">${label}</td>`;
  return `<tr>${dot}${text}</tr>`;
}

// ── Email templates per status ───────────────────────────────────────────────

function emailPending(member) {
  const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Dear Applicant';
  const body = `
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="margin:0 0 6px;color:#777;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Application Update</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px;font-weight:700;">
        Application Received
      </h2>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 8px;">Dear <strong>${name}</strong>,</p>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Thank you for submitting your membership application to the Nigerian Institution of
        Environmental Engineers (NIEE). We have successfully received your form and it is
        now awaiting review by our secretariat.
      </p>

      <div style="background:${BRAND_LIGHT};border-left:4px solid ${BRAND_GREEN};border-radius:0 6px 6px 0;
                  padding:18px 20px;margin-bottom:28px;">
        <p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:700;">What happens next?</p>
        <p style="margin:8px 0 0;color:#444444;font-size:13px;line-height:1.6;">
          Our team will review your application and verify your submitted details. The next step
          is to pay the one-time registration fee via your member dashboard to proceed.
        </p>
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
        <tr>
          <td style="padding-bottom:12px;">
            <p style="margin:0;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
              Application Progress
            </p>
          </td>
        </tr>
        <tr><td><table cellpadding="0" cellspacing="8" style="width:100%;">
          ${stepRow(1, 'Account Created', true)}
          ${stepRow(2, 'Membership Form Submitted', true)}
          ${stepRow(3, 'Registration Fee Payment', false)}
          ${stepRow(4, 'Application Under Review', false)}
          ${stepRow(5, 'Membership Approved', false)}
        </table></td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0"
             style="width:100%;border:1px solid #e8e8e8;border-radius:8px;margin-bottom:32px;">
        <tr><td style="padding:16px 20px 4px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${infoRow('Membership Type', member.membershipType)}
            ${infoRow('Chapter', member.chapter)}
            ${infoRow('Status', 'Pending Review')}
          </table>
        </td></tr>
      </table>

      <p style="text-align:center;">
        ${ctaButton('Go to My Dashboard')}
      </p>
    </td>
  </tr>`;
  return {
    subject: 'NIEE — Membership Application Received',
    html: wrapLayout(body)
  };
}

function emailRegistered(member) {
  const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Dear Member';
  const body = `
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="margin:0 0 6px;color:#777;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Application Update</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px;font-weight:700;">
        Registration Fee Confirmed
      </h2>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 8px;">Dear <strong>${name}</strong>,</p>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Your registration fee payment has been received and your application has been registered.
        Your file is now queued for review by the NIEE membership committee.
      </p>

      <div style="background:${BRAND_LIGHT};border-left:4px solid ${BRAND_GREEN};border-radius:0 6px 6px 0;
                  padding:18px 20px;margin-bottom:28px;">
        <p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:700;">Your current status</p>
        <p style="margin:10px 0 0;">${statusBadge('Registered', BRAND_GREEN, BRAND_LIGHT)}</p>
        <p style="margin:10px 0 0;color:#444444;font-size:13px;line-height:1.6;">
          Your application is now fully registered. Our membership committee will review your
          details and credentials. You will receive another email when a decision is made.
        </p>
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
        <tr>
          <td style="padding-bottom:12px;">
            <p style="margin:0;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
              Application Progress
            </p>
          </td>
        </tr>
        <tr><td><table cellpadding="0" cellspacing="8" style="width:100%;">
          ${stepRow(1, 'Account Created', true)}
          ${stepRow(2, 'Membership Form Submitted', true)}
          ${stepRow(3, 'Registration Fee Paid', true)}
          ${stepRow(4, 'Application Under Review', false)}
          ${stepRow(5, 'Membership Approved', false)}
        </table></td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0"
             style="width:100%;border:1px solid #e8e8e8;border-radius:8px;margin-bottom:32px;">
        <tr><td style="padding:16px 20px 4px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${infoRow('Membership Type', member.membershipType)}
            ${infoRow('Chapter', member.chapter)}
            ${infoRow('Status', 'Registered')}
          </table>
        </td></tr>
      </table>

      <p style="text-align:center;">
        ${ctaButton('View My Application Status')}
      </p>
    </td>
  </tr>`;
  return {
    subject: 'NIEE — Registration Fee Confirmed',
    html: wrapLayout(body)
  };
}

function emailAwaitingApproval(member) {
  const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Dear Member';
  const body = `
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="margin:0 0 6px;color:#777;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Application Update</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px;font-weight:700;">
        Under Final Review
      </h2>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 8px;">Dear <strong>${name}</strong>,</p>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Your membership application has passed the initial review stage and is now with our
        senior committee for final approval. You are in the last step before full membership is granted.
      </p>

      <div style="background:#fffbea;border-left:4px solid #f5a623;border-radius:0 6px 6px 0;
                  padding:18px 20px;margin-bottom:28px;">
        <p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:700;">Almost there!</p>
        <p style="margin:8px 0 0;color:#555555;font-size:13px;line-height:1.6;">
          Your application is currently <strong>Awaiting Final Approval</strong>. The committee
          typically completes reviews within 5–10 working days. No further action is required
          from you at this time.
        </p>
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
        <tr>
          <td style="padding-bottom:12px;">
            <p style="margin:0;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
              Application Progress
            </p>
          </td>
        </tr>
        <tr><td><table cellpadding="0" cellspacing="8" style="width:100%;">
          ${stepRow(1, 'Account Created', true)}
          ${stepRow(2, 'Membership Form Submitted', true)}
          ${stepRow(3, 'Registration Fee Paid', true)}
          ${stepRow(4, 'Awaiting Final Approval ← You are here', true)}
          ${stepRow(5, 'Membership Approved', false)}
        </table></td></tr>
      </table>

      <p style="text-align:center;">
        ${ctaButton('Check My Application Status')}
      </p>
    </td>
  </tr>`;
  return {
    subject: 'NIEE — Application Awaiting Final Approval',
    html: wrapLayout(body)
  };
}

function emailApproved(member) {
  const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Dear Member';
  const fullName = [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ');
  const body = `
  <tr>
    <td style="background:${BRAND_GREEN};padding:24px 40px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:600;letter-spacing:0.5px;">
        🎉 &nbsp; Congratulations &nbsp; 🎉
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="margin:0 0 6px;color:#777;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Membership Approved</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px;font-weight:700;">
        Welcome to NIEE!
      </h2>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 8px;">Dear <strong>${name}</strong>,</p>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 24px;">
        We are delighted to inform you that your membership application to the Nigerian Institution
        of Environmental Engineers has been <strong>approved</strong>. You are now an official member of NIEE.
      </p>

      <div style="background:${BRAND_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:8px;
                  padding:24px 28px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 4px;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
          Your NIEE Number
        </p>
        <p style="margin:0 0 12px;color:${BRAND_GREEN};font-size:28px;font-weight:800;
                  font-family:monospace;letter-spacing:2px;">
          ${member.nieeNumber || '(Assigned by secretariat)'}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="padding:0 12px;text-align:center;border-right:1px solid #cce5d7;">
              <p style="margin:0;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Full Name</p>
              <p style="margin:4px 0 0;color:#1a1a1a;font-size:13px;font-weight:600;">${fullName || name}</p>
            </td>
            <td style="padding:0 12px;text-align:center;border-right:1px solid #cce5d7;">
              <p style="margin:0;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Membership Type</p>
              <p style="margin:4px 0 0;color:#1a1a1a;font-size:13px;font-weight:600;">${member.membershipType || '—'}</p>
            </td>
            <td style="padding:0 12px;text-align:center;">
              <p style="margin:0;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Chapter</p>
              <p style="margin:4px 0 0;color:#1a1a1a;font-size:13px;font-weight:600;">${member.chapter || '—'}</p>
            </td>
          </tr>
        </table>
      </div>

      <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;color:#1a1a1a;font-size:14px;font-weight:700;">What you can do now:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#444444;">
              <span style="color:${BRAND_GREEN};font-weight:700;margin-right:8px;">✓</span>
              Download your official NIEE membership certificate from your dashboard
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#444444;">
              <span style="color:${BRAND_GREEN};font-weight:700;margin-right:8px;">✓</span>
              Pay your annual membership dues to maintain active status
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#444444;">
              <span style="color:${BRAND_GREEN};font-weight:700;margin-right:8px;">✓</span>
              Access NIEE events, resources, and chapter activities
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#444444;">
              <span style="color:${BRAND_GREEN};font-weight:700;margin-right:8px;">✓</span>
              Network with fellow environmental engineers across Nigeria
            </td>
          </tr>
        </table>
      </div>

      <p style="text-align:center;">
        ${ctaButton('Go to My Dashboard')}
      </p>

      <p style="color:#888888;font-size:12px;text-align:center;margin:24px 0 0;">
        Once again, welcome to the Nigerian Institution of Environmental Engineers. We look forward
        to your contributions to the profession.
      </p>
    </td>
  </tr>`;
  return {
    subject: `NIEE — Membership Approved 🎉 Welcome, ${name}!`,
    html: wrapLayout(body)
  };
}

function emailRejected(member) {
  const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Dear Applicant';
  const reason = member.rejectionReason
    ? `<div style="background:#fdf0f0;border-left:4px solid #dc3545;border-radius:0 6px 6px 0;
                   padding:18px 20px;margin:20px 0;">
         <p style="margin:0 0 4px;color:#dc3545;font-size:13px;font-weight:700;">Reason provided:</p>
         <p style="margin:0;color:#444444;font-size:13px;line-height:1.6;">${member.rejectionReason}</p>
       </div>`
    : '';
  const body = `
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="margin:0 0 6px;color:#777;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Application Update</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px;font-weight:700;">
        Application Not Approved
      </h2>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 8px;">Dear <strong>${name}</strong>,</p>
      <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 4px;">
        Thank you for your interest in membership with the Nigerian Institution of Environmental
        Engineers. After careful review, the NIEE membership committee was unable to approve
        your application at this time.
      </p>

      ${reason}

      <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin:24px 0 28px;">
        <p style="margin:0 0 8px;color:#1a1a1a;font-size:14px;font-weight:700;">What you can do:</p>
        <p style="margin:0 0 8px;color:#444;font-size:13px;line-height:1.6;">
          You may address the concerns raised and reapply once the issues have been resolved.
          If you believe this decision was made in error or require clarification, please contact
          the NIEE secretariat directly.
        </p>
        <p style="margin:0;font-size:13px;">
          <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND_GREEN};font-weight:600;">${CONTACT_EMAIL}</a>
        </p>
      </div>

      <p style="text-align:center;">
        ${ctaButton('Contact the Secretariat')}
      </p>

      <p style="color:#888888;font-size:12px;text-align:center;margin:24px 0 0;line-height:1.6;">
        We encourage you to address the concerns noted above and consider reapplying.
        NIEE remains committed to supporting environmental engineering professionals across Nigeria.
      </p>
    </td>
  </tr>`;
  return {
    subject: 'NIEE — Membership Application Update',
    html: wrapLayout(body)
  };
}

// ── Route status to template ─────────────────────────────────────────────────
function buildEmail(member, status) {
  const s = (status || '').toLowerCase();
  if (s === 'pending')           return emailPending(member);
  if (s === 'registered')        return emailRegistered(member);
  if (s === 'awaiting approval') return emailAwaitingApproval(member);
  if (s === 'approved')          return emailApproved(member);
  if (s === 'rejected')          return emailRejected(member);
  return null;
}

// ── Cloud Function ───────────────────────────────────────────────────────────
exports.onMemberStatusChange = onValueWritten(
  { ref: '/members/{uid}', secrets: [resendApiKey] },
  async (event) => {
    const before = event.data.before.val();
    const after  = event.data.after.val();

    if (!after) return; // member record deleted

    const oldStatus = before ? before.status : null;
    const newStatus = after.status;

    // Only proceed if status actually changed
    if (oldStatus === newStatus) return;
    if (!newStatus)              return;
    if (!after.email)            return;

    const emailContent = buildEmail(after, newStatus);
    if (!emailContent) {
      console.log(`No email template for status: ${newStatus}`);
      return;
    }

    try {
      const resend = new Resend(resendApiKey.value());
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to:   [after.email],
        subject: emailContent.subject,
        html:    emailContent.html,
      });

      if (error) {
        console.error('Resend error for', after.email, error);
        return;
      }

      console.log(`Status email sent → ${after.email} | ${oldStatus || 'new'} → ${newStatus} | id: ${data?.id}`);
    } catch (err) {
      console.error('Failed to send status email:', err.message || err);
    }
  }
);

// ── Callable: send a reminder email (called from admin portal) ───────────────
exports.sendReminderEmail = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    const { email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason } = request.data;

    if (!email)  throw new HttpsError('invalid-argument', 'email is required');
    if (!status) throw new HttpsError('invalid-argument', 'status is required');

    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
    const type = membershipType || 'Member';
    const s = (status || '').toLowerCase();

    let subject, bodyHtml;

    if (s === 'pending') {
      subject  = 'NIEE – Action Required: Complete Your Registration';
      bodyHtml = `
        <h2 style="color:#1a6b3c;margin:0 0 12px;">Complete Your Registration</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          This is a reminder that your <strong>${type}</strong> membership application is
          <strong>incomplete</strong>. Please return to the portal, fill in your application form
          and pay the <strong>₦1,000</strong> registration fee to proceed.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Complete Application
          </a>
        </div>`;
    } else if (s === 'registered') {
      subject  = 'NIEE – Reminder: Application Under Review';
      bodyHtml = `
        <h2 style="color:#1a6b3c;margin:0 0 12px;">Your Application is Under Review</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          This is a friendly reminder that your <strong>${type}</strong> membership application
          has been received and is currently <strong>under review</strong> by the secretariat.
          No action is required from you at this time.
        </p>
        <p style="color:#333;line-height:1.6;">You will receive an email once a decision has been made.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            View Application Status
          </a>
        </div>`;
    } else if (s === 'approved') {
      subject  = 'NIEE – Reminder: Pay Your Annual Dues';
      bodyHtml = `
        <h2 style="color:#e6a817;margin:0 0 12px;">Annual Dues Reminder</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          Your <strong>${type}</strong> membership${nieeNumber ? ` (${nieeNumber})` : ''} has been approved,
          but your <strong>annual dues are still outstanding</strong>. Please log in to the portal
          and make your payment to keep your membership active.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}" style="background:#e6a817;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Pay Annual Dues Now
          </a>
        </div>`;
    } else if (s === 'rejected') {
      subject  = 'NIEE – Follow-Up: Your Membership Application';
      bodyHtml = `
        <h2 style="color:#b03a2e;margin:0 0 12px;">Follow-Up on Your Application</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          We are following up regarding your <strong>${type}</strong> membership application
          which was not approved.
          ${rejectionReason ? `The reason provided was: <em>${rejectionReason}</em>.` : ''}
          If you have addressed the issues raised, you are welcome to contact the secretariat
          or reapply through the portal.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Visit Portal
          </a>
        </div>`;
    } else {
      throw new HttpsError('invalid-argument', `No reminder template for status: ${status}`);
    }

    const html = wrapLayout(`<tr><td style="padding:40px;">${bodyHtml}</td></tr>`);

    try {
      const resend = new Resend(resendApiKey.value());
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html,
      });
      if (error) throw new HttpsError('internal', error.message || 'Resend error');
      console.log(`Reminder sent → ${email} (${status}) | id: ${data?.id}`);
      return { success: true, id: data?.id };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err.message || 'Failed to send email');
    }
  }
);
