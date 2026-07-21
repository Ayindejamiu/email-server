require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const admin = require('firebase-admin');
const {
  registeredEmail, approvedEmail, rejectedEmail,
  reminderPendingEmail, reminderRegisteredEmail, reminderApprovedEmail, reminderRejectedEmail,
  fadahunsiRegistrationEmail, agmRegistrationEmail,
  abstractSubmissionEmail, fullPaperSubmissionEmail,
  fellowApplicationEmail
} = require('./templates');

// Initialize Firebase Admin SDK if service account is configured
let adminInitialized = false;
try {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath && !admin.apps.length) {
    const serviceAccount = require(path.resolve(saPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://nieeportal-default-rtdb.firebaseio.com'
    });
    adminInitialized = true;
    console.log('[Firebase Admin] Initialized successfully');
  } else if (!saPath) {
    console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_PATH not set — /api/update-auth-email will be unavailable');
  }
} catch (e) {
  console.error('[Firebase Admin] Init failed:', e.message);
}

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// POST /api/send-status-email
// Body: { email, firstName, lastName, status, membershipType, nieeNumber?, rejectionReason? }
app.post('/api/send-status-email', async (req, res) => {
  const { email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason } = req.body;

  if (!email || !status) {
    return res.status(400).json({ error: 'email and status are required' });
  }

  const statusLower = (status || '').toLowerCase();
  let template;

  if (statusLower === 'registered') {
    template = registeredEmail({ firstName, lastName, membershipType });
  } else if (statusLower === 'approved') {
    template = approvedEmail({ firstName, lastName, membershipType, nieeNumber });
  } else if (statusLower === 'rejected') {
    template = rejectedEmail({ firstName, lastName, membershipType, rejectionReason });
  } else {
    return res.status(400).json({ error: `No email template for status: ${status}` });
  }

  try {
    const result = await resend.emails.send({
      from: 'NIEE Portal <noreply@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] Email sent to ${email} (status: ${status}) — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send email to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/send-reminder-email
// Body: { email, firstName, lastName, status, membershipType, nieeNumber?, rejectionReason? }
app.post('/api/send-reminder-email', async (req, res) => {
  const { email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason } = req.body;

  if (!email || !status) {
    return res.status(400).json({ error: 'email and status are required' });
  }

  const statusLower = (status || '').toLowerCase();
  let template;

  if (statusLower === 'pending') {
    template = reminderPendingEmail({ firstName, lastName, membershipType });
  } else if (statusLower === 'registered') {
    template = reminderRegisteredEmail({ firstName, lastName, membershipType });
  } else if (statusLower === 'approved') {
    template = reminderApprovedEmail({ firstName, lastName, membershipType, nieeNumber });
  } else if (statusLower === 'rejected') {
    template = reminderRejectedEmail({ firstName, lastName, membershipType, rejectionReason });
  } else {
    return res.status(400).json({ error: `No reminder template for status: ${status}` });
  }

  try {
    const result = await resend.emails.send({
      from: 'NIEE Portal <noreply@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] Reminder sent to ${email} (status: ${status}) — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send reminder to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/update-auth-email
// Body: { uid, newEmail }
// Requires Firebase Admin SDK to be initialized via FIREBASE_SERVICE_ACCOUNT_PATH
app.post('/api/update-auth-email', async (req, res) => {
  const { uid, newEmail } = req.body;

  if (!uid || !newEmail) {
    return res.status(400).json({ error: 'uid and newEmail are required' });
  }
  if (!adminInitialized) {
    return res.status(503).json({ error: 'Firebase Admin not configured on this server' });
  }

  try {
    await admin.auth().updateUser(uid, { email: newEmail });
    console.log(`[${new Date().toISOString()}] Auth email updated for uid ${uid} → ${newEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to update auth email for uid ${uid}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/send-event-registration-email
// Body: { email, name, registrationCode, sex, isNieeMember }
app.post('/api/send-event-registration-email', async (req, res) => {
  const { email, name, registrationCode, sex, isNieeMember } = req.body;
  if (!email || !name || !registrationCode) {
    return res.status(400).json({ error: 'email, name and registrationCode are required' });
  }
  try {
    const template = fadahunsiRegistrationEmail({ name, registrationCode, sex, isNieeMember });
    const result = await resend.emails.send({
      from: 'NIEE Secretariat <secretary@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] Event reg email sent to ${email} — code: ${registrationCode} — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send event reg email to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/send-agm-registration-email
// Body: { email, name, registrationCode, nieeNumber, branch, category, hasSpouse, amount }
app.post('/api/send-agm-registration-email', async (req, res) => {
  const { email, name, registrationCode, nieeNumber, branch, category, hasSpouse, amount } = req.body;
  if (!email || !name || !registrationCode) {
    return res.status(400).json({ error: 'email, name and registrationCode are required' });
  }
  try {
    const template = agmRegistrationEmail({ name, registrationCode, nieeNumber, branch, category, hasSpouse, amount });
    const result = await resend.emails.send({
      from: 'NIEE Secretariat <secretary@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] AGM reg email sent to ${email} — code: ${registrationCode} — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send AGM reg email to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/send-paper-submission-email
// Body: { stage: 'abstract'|'fullpaper', email, name, submissionCode, paperTitle, subtheme }
app.post('/api/send-paper-submission-email', async (req, res) => {
  const { stage, email, name, submissionCode, paperTitle, subtheme } = req.body;
  if (!email || !name || !submissionCode || !stage) {
    return res.status(400).json({ error: 'stage, email, name and submissionCode are required' });
  }
  try {
    const template = stage === 'fullpaper'
      ? fullPaperSubmissionEmail({ name, submissionCode, paperTitle, subtheme })
      : abstractSubmissionEmail({ name, submissionCode, paperTitle, subtheme });
    const result = await resend.emails.send({
      from: 'NIEE Secretariat <secretary@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] Paper ${stage} email sent to ${email} — code: ${submissionCode} — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send paper ${stage} email to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/send-fellow-application-email
// Body: { email, name, referenceCode }
app.post('/api/send-fellow-application-email', async (req, res) => {
  const { email, name, referenceCode } = req.body;
  if (!email || !name || !referenceCode) {
    return res.status(400).json({ error: 'email, name and referenceCode are required' });
  }
  try {
    const template = fellowApplicationEmail({ name, referenceCode });
    const result = await resend.emails.send({
      from: 'NIEE Secretariat <secretary@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] Fellow application email sent to ${email} — ref: ${referenceCode} — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send fellow application email to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', adminReady: adminInitialized }));

app.listen(PORT, () => {
  console.log(`NIEE email server running on port ${PORT}`);
});
