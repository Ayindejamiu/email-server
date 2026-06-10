const PORTAL_URL = process.env.PORTAL_URL || 'https://nieeportal.firebaseapp.com';
const LOGO_URL = process.env.LOGO_URL || 'https://nieeportal.firebaseapp.com/assets/img/niee.jpg';

const baseStyle = `
  font-family: 'Segoe UI', Arial, sans-serif;
  margin: 0; padding: 0; background-color: #f4f6f9;
`;

function wrapper(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NIEE Portal Notification</title>
</head>
<body style="${baseStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%);padding:32px 40px;text-align:center;">
            <img src="${LOGO_URL}" alt="NIEE Logo" width="80" height="80" style="display:block;margin:0 auto 14px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.3);" />
            <p style="color:#ffffff;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Nigerian Institution of Environmental Engineers</p>
            <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0;letter-spacing:0.5px;">NIEE Portal</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;border-top:1px solid #e8ecf0;padding:24px 40px;text-align:center;">
            <p style="color:#6b7280;font-size:12px;margin:0 0 6px;">Nigerian Institution of Environmental Engineers</p>
            <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated notification. Please do not reply to this email.</p>
            <p style="margin:12px 0 0;">
              <a href="${PORTAL_URL}" style="color:#2563a8;font-size:12px;text-decoration:none;">Visit Portal</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function divider() {
  return `<tr><td height="1" style="background:#e8ecf0;margin:24px 0;display:block;"></td></tr>`;
}

// ── Pending → Registered (registration payment confirmed) ────────────────────
function registeredEmail({ firstName, lastName, membershipType }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#dbeafe;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">📋</div>
    </div>
    <h2 style="color:#1a3a5c;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Application Received</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">Your registration fee has been confirmed.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Thank you for completing your registration fee payment. Your membership application for
      <strong>${membershipType || 'NIEE Membership'}</strong> has been received and is now under review by our team.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-left:4px solid #2563a8;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#1e40af;font-size:14px;font-weight:600;margin:0 0 6px;">What happens next?</p>
          <ul style="color:#374151;font-size:14px;line-height:1.8;margin:0;padding-left:18px;">
            <li>Our admin team will review your application details</li>
            <li>You will receive an email once your membership is approved</li>
            <li>Upon approval, you can log in to pay your annual dues and download your certificate</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 28px;">
      If you have any questions, please contact us through the portal.
    </p>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#2563a8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        View Application Status
      </a>
    </div>
  `;
  return { subject: 'Application Received – Under Review | NIEE Portal', html: wrapper(body) };
}

// ── Registered/Pending → Approved ────────────────────────────────────────────
function approvedEmail({ firstName, lastName, membershipType, nieeNumber }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">🎉</div>
    </div>
    <h2 style="color:#065f46;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Congratulations! Membership Approved</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">Welcome to the Nigerian Institution of Environmental Engineers.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We are delighted to inform you that your application for <strong>${membershipType || 'NIEE Membership'}</strong>
      has been <strong style="color:#059669;">approved</strong>. You are now an official member of NIEE.
    </p>

    ${nieeNumber ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center;">
      <tr>
        <td>
          <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Your NIEE Membership Number</p>
          <p style="color:#065f46;font-size:24px;font-weight:700;letter-spacing:2px;margin:0;">${nieeNumber}</p>
        </td>
      </tr>
    </table>` : ''}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 6px;">⚠️ Action Required — Complete Your Registration</p>
          <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 8px;">
            To activate your full membership and download your certificate, you must pay your
            <strong>annual membership dues</strong>. Log in to the portal to complete this step.
          </p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="16" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:0 0 28px;">
      <tr>
        <td style="border-bottom:1px solid #e8ecf0;">
          <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Membership Type</p>
          <p style="color:#1a3a5c;font-size:15px;font-weight:600;margin:0;">${membershipType || '—'}</p>
        </td>
      </tr>
      <tr>
        <td>
          <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Next Step</p>
          <p style="color:#1a3a5c;font-size:15px;font-weight:600;margin:0;">Pay Annual Dues to Activate Membership</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        Log In &amp; Pay Annual Dues
      </a>
    </div>
  `;
  return { subject: 'Membership Approved – Action Required | NIEE Portal', html: wrapper(body) };
}

// ── Rejected ──────────────────────────────────────────────────────────────────
function rejectedEmail({ firstName, lastName, membershipType, rejectionReason }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#fee2e2;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">📄</div>
    </div>
    <h2 style="color:#991b1b;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Application Update</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">Regarding your Nigerian Institution of Environmental Engineers membership application.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      After careful review, we regret to inform you that your application for
      <strong>${membershipType || 'NIEE Membership'}</strong> was not approved at this time.
    </p>

    ${rejectionReason ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#991b1b;font-size:14px;font-weight:600;margin:0 0 6px;">Reason provided:</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${rejectionReason}</p>
        </td>
      </tr>
    </table>` : ''}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      You may address the concerns above and reapply, or contact us through the portal for further clarification.
    </p>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#2563a8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        Visit Portal
      </a>
    </div>
  `;
  return { subject: 'Application Update | NIEE Portal', html: wrapper(body) };
}

// ── Reminder: Pending (hasn't paid registration fee) ─────────────────────────
function reminderPendingEmail({ firstName, lastName, membershipType }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#fef3c7;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">⏳</div>
    </div>
    <h2 style="color:#92400e;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Your Application is Incomplete</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">Action is required to proceed with your Nigerian Institution of Environmental Engineers (NIEE) membership.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      You submitted a membership application for <strong>${membershipType || 'NIEE Membership'}</strong>,
      but your registration is not yet complete. We have not received your one-time registration fee.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 6px;">What you need to do:</p>
          <ul style="color:#374151;font-size:14px;line-height:1.8;margin:0;padding-left:18px;">
            <li>Log in to the NIEE portal</li>
            <li>Pay the one-time registration fee of <strong>₦1,000</strong> to submit your application for review</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 28px;">
      If you have already made this payment, please log in to confirm your status or contact us for assistance.
    </p>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        Log In &amp; Complete Payment
      </a>
    </div>
  `;
  return { subject: 'Action Required: Complete Your NIEE Registration | NIEE Portal', html: wrapper(body) };
}

// ── Reminder: Registered (application under review, nudge to be patient / check portal) ──
function reminderRegisteredEmail({ firstName, lastName, membershipType }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#dbeafe;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">📋</div>
    </div>
    <h2 style="color:#1e40af;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Application Still Under Review</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">We are still processing your Nigerian Institution of Environmental Engineers (NIEE) membership application.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      This is a reminder that your application for <strong>${membershipType || 'NIEE Membership'}</strong>
      has been received and is currently under review by our team. No further action is required from you at this time.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#1e40af;font-size:14px;font-weight:600;margin:0 0 6px;">What happens next?</p>
          <ul style="color:#374151;font-size:14px;line-height:1.8;margin:0;padding-left:18px;">
            <li>Our admin team is reviewing your application details</li>
            <li>You will receive an email notification once a decision is made</li>
            <li>You can check your current status at any time by logging in to the portal</li>
          </ul>
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#2563a8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        Check Application Status
      </a>
    </div>
  `;
  return { subject: 'Reminder: Your NIEE Application is Under Review | NIEE Portal', html: wrapper(body) };
}

// ── Reminder: Approved (hasn't paid annual dues yet) ─────────────────────────
function reminderApprovedEmail({ firstName, lastName, membershipType, nieeNumber }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">🔔</div>
    </div>
    <h2 style="color:#065f46;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Reminder: Activate Your Membership</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">Your Nigerian Institution of Environmental Engineers (NIEE) membership has been approved — one step remaining.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Your application for <strong>${membershipType || 'NIEE Membership'}</strong> was approved
      ${nieeNumber ? `and your membership number is <strong style="color:#065f46;">${nieeNumber}</strong>` : ''}.
      However, we notice that your <strong>annual membership dues have not yet been paid</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 6px;">⚠️ Your membership is not yet fully active</p>
          <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">
            Please log in to the portal and pay your annual dues to complete your membership and unlock your certificate.
          </p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        Log In &amp; Pay Annual Dues
      </a>
    </div>
  `;
  return { subject: 'Reminder: Pay Your Annual Dues to Activate Membership | NIEE Portal', html: wrapper(body) };
}

// ── Reminder: Rejected (follow up / reapply) ─────────────────────────────────
function reminderRejectedEmail({ firstName, lastName, membershipType, rejectionReason }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#fee2e2;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">📩</div>
    </div>
    <h2 style="color:#991b1b;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Follow-Up on Your Application</h2>
    <p style="color:#4b5563;font-size:15px;text-align:center;margin:0 0 28px;">Regarding your Nigerian Institution of Environmental Engineers (NIEE) membership application.</p>

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We want to follow up on your application for <strong>${membershipType || 'NIEE Membership'}</strong>,
      which was not approved. We encourage you to review the reason below and consider reapplying once the issue is resolved.
    </p>

    ${rejectionReason ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;padding:16px 20px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="color:#991b1b;font-size:14px;font-weight:600;margin:0 0 6px;">Reason for rejection:</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${rejectionReason}</p>
        </td>
      </tr>
    </table>` : ''}

    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 28px;">
      If you have questions or need clarification, please log in to the portal or contact us directly.
    </p>

    <div style="text-align:center;">
      <a href="${PORTAL_URL}/dashboard.html"
         style="display:inline-block;background:#2563a8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:6px;">
        Visit Portal
      </a>
    </div>
  `;
  return { subject: 'Follow-Up: Your NIEE Membership Application | NIEE Portal', html: wrapper(body) };
}

module.exports = {
  registeredEmail, approvedEmail, rejectedEmail,
  reminderPendingEmail, reminderRegisteredEmail, reminderApprovedEmail, reminderRejectedEmail
};
