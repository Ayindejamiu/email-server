require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const admin = require('firebase-admin');
const {
  registeredEmail, approvedEmail, rejectedEmail,
  reminderPendingEmail, reminderRegisteredEmail, reminderApprovedEmail, reminderRejectedEmail,
  fadahunsiRegistrationEmail, agmRegistrationEmail,
  abstractSubmissionEmail, fullPaperSubmissionEmail,
  fellowApplicationEmail, cpdRegistrationEmail
} = require('./templates');

// Initialize Firebase Admin SDK if service account is configured.
// Two ways to supply credentials:
//  - FIREBASE_SERVICE_ACCOUNT_PATH: path to a JSON key file on disk (local dev)
//  - FIREBASE_SERVICE_ACCOUNT_JSON: the JSON key contents as a single env var
//    (use this on Render/hosts with no persistent filesystem for secret files)
let adminInitialized = false;
try {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let serviceAccount = null;
  if (saJson) {
    serviceAccount = JSON.parse(saJson);
  } else if (saPath) {
    serviceAccount = require(path.resolve(saPath));
  }

  if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://nieeportal-default-rtdb.firebaseio.com'
    });
    adminInitialized = true;
    console.log('[Firebase Admin] Initialized successfully');
  } else if (!serviceAccount) {
    console.warn('[Firebase Admin] Neither FIREBASE_SERVICE_ACCOUNT_JSON nor FIREBASE_SERVICE_ACCOUNT_PATH set — /api/update-auth-email and /api/paystack-webhook will be unavailable');
  }
} catch (e) {
  console.error('[Firebase Admin] Init failed:', e.message);
}

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT = process.env.PORT || 3001;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

app.use(cors());

// Helper: look up authUid from members_registry by email
async function resolveUidByEmail(db, email) {
  if (!email) return null;
  try {
    const snap = await db.ref('members_registry').orderByChild('email').equalTo(email.trim()).once('value');
    if (snap.exists()) {
      const data = snap.val();
      const uid = data[Object.keys(data)[0]].authUid;
      return uid || null;
    }
  } catch (_) {}
  return null;
}

// POST /api/paystack-webhook
// Registered before express.json() because signature verification needs the raw request body.
// Configure this URL in the Paystack Dashboard → Settings → API Keys & Webhooks.
app.post('/api/paystack-webhook', express.raw({ type: '*/*' }), async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) {
    console.error('[Paystack Webhook] PAYSTACK_SECRET_KEY not set — rejecting webhook');
    return res.sendStatus(500);
  }

  const signature = req.headers['x-paystack-signature'];
  const expectedHash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
  if (!signature || signature !== expectedHash) {
    console.warn('[Paystack Webhook] Invalid signature — rejecting');
    return res.sendStatus(401);
  }

  // Ack immediately — Paystack retries on anything but a fast 2xx, and any
  // failure below is now a reconciliation problem, not a delivery problem.
  res.sendStatus(200);

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    console.error('[Paystack Webhook] Failed to parse payload:', e.message);
    return;
  }

  if (event.event !== 'charge.success') return;

  if (!adminInitialized) {
    console.error('[Paystack Webhook] Firebase Admin not configured — cannot record payment', event.data?.reference);
    return;
  }

  const data = event.data || {};
  const { reference, amount, metadata } = data;
  const purpose = (metadata && metadata.purpose) || '';
  const customerEmail = (data.customer && data.customer.email) || '';
  const amountNgn = (amount || 0) / 100;

  if (!reference) {
    console.warn('[Paystack Webhook] No reference in charge.success payload — skipping');
    return;
  }

  const db = admin.database();

  // === AGM 2026 Registration (bank transfer fallback) ===
  if (purpose === 'agm_registration') {
    try {
      // Idempotency: don't create duplicate if client callback already saved it
      const existSnap = await db.ref('events/agm-2026')
        .orderByChild('reference').equalTo(reference).once('value');
      if (existSnap.exists()) {
        console.log('[Paystack Webhook] AGM registration already exists for', reference);
        return;
      }

      const { committed, snapshot: cSnap } = await db.ref('events/agm-2026-counter')
        .transaction(n => (n || 0) + 1);
      if (!committed) throw new Error('Counter transaction not committed');
      const registrationCode = 'AGM-2026-' + String(cSnap.val()).padStart(4, '0');

      const regData = {
        name:       (metadata && metadata.name)       || '',
        phone:      (metadata && metadata.phone)      || '',
        email:      customerEmail,
        nieeNumber: (metadata && metadata.nieeNumber) || '',
        branch:     (metadata && metadata.branch)     || '',
        category:   (metadata && metadata.category)   || '',
        hasSpouse:  (metadata && metadata.hasSpouse)  || false,
        amount:     amountNgn,
        reference,
        verified:   true,
        registrationCode,
        registeredAt: data.paid_at || new Date().toISOString(),
        source: 'webhook'
      };
      await db.ref('events/agm-2026').push(regData);

      try {
        const tmpl = agmRegistrationEmail({
          name: regData.name, registrationCode,
          nieeNumber: regData.nieeNumber, branch: regData.branch,
          category: regData.category, hasSpouse: regData.hasSpouse, amount: amountNgn
        });
        await resend.emails.send({
          from: 'NIEE Secretariat <secretary@niee.org.ng>',
          to: customerEmail, subject: tmpl.subject, html: tmpl.html
        });
      } catch (emailErr) {
        console.warn('[Paystack Webhook] AGM email failed:', emailErr.message);
      }

      console.log('[Paystack Webhook] AGM registration created:', registrationCode, 'for', customerEmail);
    } catch (err) {
      console.error('[Paystack Webhook] AGM registration failed for', reference, ':', err.message);
    }
    return;
  }

  // === CPD 2026 Registration (bank transfer fallback) ===
  if (purpose === 'cpd_registration') {
    try {
      const existSnap = await db.ref('events/cpd-2026')
        .orderByChild('reference').equalTo(reference).once('value');
      if (existSnap.exists()) {
        console.log('[Paystack Webhook] CPD registration already exists for', reference);
        return;
      }

      const { committed, snapshot: cSnap } = await db.ref('events/cpd-2026-counter')
        .transaction(n => (n || 0) + 1);
      if (!committed) throw new Error('Counter transaction not committed');
      const registrationCode = 'CPD-2026-' + String(cSnap.val()).padStart(4, '0');

      const regData = {
        name:       (metadata && metadata.name)       || '',
        phone:      (metadata && metadata.phone)      || '',
        email:      customerEmail,
        nieeNumber: (metadata && metadata.nieeNumber) || '',
        category:   (metadata && metadata.category)   || '',
        amount:     amountNgn,
        reference,
        verified:   true,
        registrationCode,
        registeredAt: data.paid_at || new Date().toISOString(),
        source: 'webhook'
      };
      await db.ref('events/cpd-2026').push(regData);

      try {
        const tmpl = cpdRegistrationEmail({
          name: regData.name, registrationCode,
          category: regData.category, amount: amountNgn,
          nieeNumber: regData.nieeNumber
        });
        await resend.emails.send({
          from: 'NIEE Secretariat <secretary@niee.org.ng>',
          to: customerEmail, subject: tmpl.subject, html: tmpl.html
        });
      } catch (emailErr) {
        console.warn('[Paystack Webhook] CPD email failed:', emailErr.message);
      }

      console.log('[Paystack Webhook] CPD registration created:', registrationCode, 'for', customerEmail);
    } catch (err) {
      console.error('[Paystack Webhook] CPD registration failed for', reference, ':', err.message);
    }
    return;
  }

  // === Membership payment (initial_registration, registration_fee, annual_dues) ===
  let uid = metadata && metadata.uid;

  // Bank transfers and some card payments arrive without uid — look up by email
  if (!uid && customerEmail) {
    uid = await resolveUidByEmail(db, customerEmail);
    if (uid) console.log('[Paystack Webhook] Resolved uid by email:', customerEmail, '->', uid);
  }

  if (!uid) {
    console.warn('[Paystack Webhook] Cannot resolve uid for reference', reference, '(email:', customerEmail, ')');
    return;
  }

  try {
    const paymentsRef = db.ref(`payments/${uid}`);

    // Idempotency: don't double-record (client callback may have beaten us)
    const existing = await paymentsRef.orderByChild('reference').equalTo(reference).once('value');
    if (existing.exists()) {
      console.log('[Paystack Webhook] Reference already recorded, skipping', reference);
      return;
    }

    const paymentRecord = {
      reference,
      amount: amountNgn,
      type: purpose === 'annual_dues' ? 'membership' : 'registration',
      verified: true,
      date: data.paid_at || new Date().toISOString(),
      email: customerEmail,
      source: 'webhook'
    };
    if (purpose === 'annual_dues') {
      paymentRecord.membershipType = (metadata && metadata.membershipType) || '';
      paymentRecord.year = (metadata && metadata.year) || '';
    }

    await paymentsRef.push(paymentRecord);

    if (purpose === 'initial_registration' || purpose === 'registration_fee') {
      const memberRef = db.ref(`members/${uid}`);
      const memberSnap = await memberRef.once('value');
      if (memberSnap.exists()) {
        await memberRef.update({ status: 'Registered', registrationPaidAt: new Date().toISOString() });
      } else {
        console.warn('[Paystack Webhook] No member record for uid — status not updated', uid);
      }
    }

    console.log(`[Paystack Webhook] Recorded ${purpose || 'unknown'} payment ${reference} for uid ${uid}`);
  } catch (err) {
    console.error('[Paystack Webhook] Failed to record payment', reference, err.message);
  }
});

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

// POST /api/send-cpd-registration-email
// Body: { email, name, registrationCode, category, branch, institution, nieeNumber, amount }
app.post('/api/send-cpd-registration-email', async (req, res) => {
  const { email, name, registrationCode, category, branch, institution, nieeNumber, amount } = req.body;
  if (!email || !name || !registrationCode) {
    return res.status(400).json({ error: 'email, name and registrationCode are required' });
  }
  try {
    const template = cpdRegistrationEmail({ name, registrationCode, category, branch, institution, nieeNumber, amount });
    const result = await resend.emails.send({
      from: 'NIEE Secretariat <secretary@niee.org.ng>',
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[${new Date().toISOString()}] CPD reg email sent to ${email} — code: ${registrationCode} — id: ${result.data?.id}`);
    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send CPD reg email to ${email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});


// POST /api/admin/sync-payment
// Used by the admin panel to retroactively sync a Paystack payment to Firebase.
// Requires a valid Firebase ID token from an admin user in Authorization header.
// Body: { email, reference, amount, channel?, date? }
app.post('/api/admin/sync-payment', async (req, res) => {
  if (!adminInitialized) return res.status(503).json({ error: 'Firebase Admin not configured' });

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return res.status(401).json({ error: 'No auth token provided' });

  try {
    const db = admin.database();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const adminSnap = await db.ref(`admins/${decoded.uid}`).once('value');
    if (!adminSnap.val()) return res.status(403).json({ error: 'Not an admin' });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email, reference, amount, channel, date } = req.body;
  if (!email || !reference) return res.status(400).json({ error: 'email and reference are required' });

  try {
    const db = admin.database();

    // Look up member by email in members_registry (indexed on email)
    const registrySnap = await db.ref('members_registry')
      .orderByChild('email').equalTo(email.trim()).once('value');
    const registryData = registrySnap.val();

    if (!registryData) {
      return res.json({ status: 'not_found', reason: 'No member found with email: ' + email });
    }

    const nieeNumber = Object.keys(registryData)[0];
    const memberUid  = registryData[nieeNumber].authUid;

    if (!memberUid) {
      return res.json({ status: 'skipped', reason: `Member ${nieeNumber} exists but has not linked a portal account` });
    }

    // Idempotency: don't double-record
    const paymentsRef = db.ref(`payments/${memberUid}`);
    const existing = await paymentsRef.orderByChild('reference').equalTo(reference).once('value');
    if (existing.exists()) {
      return res.json({ status: 'skipped', reason: 'Payment already recorded', nieeNumber, uid: memberUid });
    }

    // Infer purpose from amount
    const amountNgn = parseFloat(amount) || 0;
    let inferredPurpose = 'payment';
    let membershipType = '';
    if (amountNgn <= 1500)       { inferredPurpose = 'registration_fee'; }
    else if (amountNgn === 15000) { inferredPurpose = 'annual_dues'; membershipType = 'Graduate Member'; }
    else if (amountNgn === 25000) { inferredPurpose = 'annual_dues'; membershipType = 'Corporate Member'; }
    else if (amountNgn === 35000) { inferredPurpose = 'annual_dues'; membershipType = 'Fellow Member'; }

    const paymentRecord = {
      reference,
      amount:   amountNgn,
      type:     inferredPurpose === 'annual_dues' ? 'membership' : 'registration',
      verified: true,
      date:     date || new Date().toISOString(),
      email,
      channel:  channel || 'bank_transfer',
      source:   'admin_sync'
    };
    if (membershipType) paymentRecord.membershipType = membershipType;

    await paymentsRef.push(paymentRecord);

    // Promote Pending → Registered for registration fee payments
    let statusUpdated = false;
    if (inferredPurpose === 'registration_fee') {
      const memberSnap = await db.ref(`members/${memberUid}`).once('value');
      if (memberSnap.exists() && memberSnap.val().status === 'Pending') {
        await db.ref(`members/${memberUid}`).update({
          status: 'Registered',
          registrationPaidAt: date || new Date().toISOString()
        });
        statusUpdated = true;
      }
    }

    return res.json({ status: 'synced', nieeNumber, uid: memberUid, purpose: inferredPurpose, membershipType: membershipType || undefined, statusUpdated });
  } catch (err) {
    console.error('[Admin Sync] Failed for reference', reference, err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', adminReady: adminInitialized, paystackWebhookReady: !!PAYSTACK_SECRET_KEY }));

app.listen(PORT, () => {
  console.log(`NIEE email server running on port ${PORT}`);
});
