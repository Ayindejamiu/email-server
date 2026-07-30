// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  get,
  update,
  push,
  set,
  remove,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// ── Email server (Render) — all outbound emails routed through here ──────────
const PORTAL_URL      = 'https://niee.org.ng/portal';
const EMAIL_SERVER_URL = 'https://email-server-t67z.onrender.com';

function _nieeEmailWrapper(bodyHtml) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f4;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#1a6b3c,#2d9e5f);padding:28px 36px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:.5px;">NIEE Member Portal</h1>
        <p style="color:#c8f0d8;margin:4px 0 0;font-size:13px;">Nigerian Institution of Environmental Engineers</p>
      </td></tr>
      <tr><td style="padding:32px 36px;">${bodyHtml}</td></tr>
      <tr><td style="background:#f0f4f2;padding:16px 36px;text-align:center;font-size:12px;color:#666;">
        © ${new Date().getFullYear()} NIEE · <a href="${PORTAL_URL}" style="color:#1a6b3c;">Member Portal</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function _nieeEmailTemplates(status, { firstName, lastName, membershipType, nieeNumber, rejectionReason }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const type = membershipType || 'Member';
  const s = (status || '').toLowerCase();

  if (s === 'registered') {
    return {
      subject: 'NIEE – Application Received & Under Review',
      html: _nieeEmailWrapper(`
        <h2 style="color:#1a6b3c;margin:0 0 12px;">Application Received</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          Thank you for completing your <strong>${type}</strong> application and paying the ₦1,000 registration fee.
          Your application has been received and is now <strong>under review</strong> by the secretariat.
        </p>
        <p style="color:#333;line-height:1.6;">
          You will receive another email once a decision has been made. In the meantime, you can track your
          application status in the member portal.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}/dashboard.html" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            View My Application
          </a>
        </div>
        <p style="color:#555;font-size:13px;line-height:1.6;">
          If you have any questions, please contact the NIEE secretariat.
        </p>`)
    };
  }

  if (s === 'approved') {
    return {
      subject: 'NIEE – Membership Approved 🎉',
      html: _nieeEmailWrapper(`
        <h2 style="color:#1a6b3c;margin:0 0 12px;">Congratulations — You're Approved!</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          We are pleased to inform you that your <strong>${type}</strong> membership application has been
          <strong>approved</strong>${nieeNumber ? ` and your NIEE membership number is <strong>${nieeNumber}</strong>` : ''}.
        </p>
        <p style="color:#333;line-height:1.6;">
          To activate your membership, please log in to the portal and pay your annual membership dues.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}/dashboard.html" style="background:#e6a817;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Pay Annual Dues Now
          </a>
        </div>
        <p style="color:#555;font-size:13px;line-height:1.6;">
          Welcome to NIEE. We look forward to your contributions to the profession.
        </p>`)
    };
  }

  if (s === 'rejected') {
    return {
      subject: 'NIEE – Application Update',
      html: _nieeEmailWrapper(`
        <h2 style="color:#b03a2e;margin:0 0 12px;">Application Status Update</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          We regret to inform you that your <strong>${type}</strong> membership application was
          <strong>not approved</strong> at this time.
        </p>
        ${rejectionReason ? `<p style="color:#333;line-height:1.6;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
        <p style="color:#333;line-height:1.6;">
          If you believe this decision was made in error, or you would like to reapply after addressing
          any issues, please contact the secretariat.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}/dashboard.html" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Visit Portal
          </a>
        </div>`)
    };
  }

  return null;
}

async function sendStatusEmail(email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason) {
  if (!email) return;
  try {
    const res = await fetch(`${EMAIL_SERVER_URL}/api/send-status-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Status email failed:', err.error || res.status);
    } else {
      console.log(`[Email] ${status} notification sent to ${email}`);
    }
  } catch (err) {
    console.warn('Status email failed (non-blocking):', err.message);
  }
}

// Reminder email templates (sent by admin from the member list)
function _nieeReminderTemplates(status, { firstName, lastName, membershipType, nieeNumber, rejectionReason }) {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Member';
  const type = membershipType || 'Member';
  const s = (status || '').toLowerCase();

  if (s === 'pending') {
    return {
      subject: 'NIEE – Action Required: Complete Your Registration',
      html: _nieeEmailWrapper(`
        <h2 style="color:#1a6b3c;margin:0 0 12px;">Complete Your Registration</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          This is a reminder that your <strong>${type}</strong> membership application is
          <strong>incomplete</strong>. Please return to the portal, fill in your application form
          and pay the <strong>₦1,000</strong> registration fee to proceed.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}/membership-form.html" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Complete Application
          </a>
        </div>`)
    };
  }

  if (s === 'registered') {
    return {
      subject: 'NIEE – Reminder: Application Under Review',
      html: _nieeEmailWrapper(`
        <h2 style="color:#1a6b3c;margin:0 0 12px;">Your Application is Under Review</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          This is a friendly reminder that your <strong>${type}</strong> membership application
          has been received and is currently <strong>under review</strong> by the secretariat.
          No action is required from you at this time.
        </p>
        <p style="color:#333;line-height:1.6;">You will receive an email once a decision has been made.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}/dashboard.html" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            View Application Status
          </a>
        </div>`)
    };
  }

  if (s === 'approved') {
    return {
      subject: 'NIEE – Reminder: Pay Your Annual Dues',
      html: _nieeEmailWrapper(`
        <h2 style="color:#e6a817;margin:0 0 12px;">Annual Dues Reminder</h2>
        <p style="color:#333;line-height:1.6;">Dear <strong>${name}</strong>,</p>
        <p style="color:#333;line-height:1.6;">
          Your <strong>${type}</strong> membership${nieeNumber ? ` (${nieeNumber})` : ''} has been approved,
          but your <strong>annual dues are still outstanding</strong>. Please log in to the portal
          and make your payment to keep your membership active.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${PORTAL_URL}/dashboard.html" style="background:#e6a817;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Pay Annual Dues Now
          </a>
        </div>`)
    };
  }

  if (s === 'rejected') {
    return {
      subject: 'NIEE – Follow-Up: Your Membership Application',
      html: _nieeEmailWrapper(`
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
          <a href="${PORTAL_URL}/dashboard.html" style="background:#1a6b3c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
            Visit Portal
          </a>
        </div>`)
    };
  }

  return null;
}

async function sendReminderEmail(email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason) {
  if (!email) return { success: false, error: 'No email address' };
  try {
    const resp = await fetch(`${EMAIL_SERVER_URL}/api/send-reminder-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, firstName, lastName, status, membershipType, nieeNumber, rejectionReason })
    });
    const result = await resp.json();
    if (!resp.ok) return { success: false, error: result.error || `HTTP ${resp.status}` };
    console.log(`[Email] ${status} reminder sent to ${email}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA2shORfx2zny40pH_ATV-VoR8NLXECAoo",
  authDomain: "nieeportal.firebaseapp.com",
  databaseURL: "https://nieeportal-default-rtdb.firebaseio.com",
  projectId: "nieeportal",
  storageBucket: "nieeportal.appspot.com",
  messagingSenderId: "562299924853",
  appId: "1:562299924853:web:235c52db78bc4cd141233c"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Google sign-in removed: using email/password only
const db = getDatabase(app);

window.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const membershipForm = document.getElementById('membershipForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const paymentYears = document.getElementById('paymentYears');
  const paymentTableBody = document.getElementById('paymentTableBody');
  const paymentHistory = document.getElementById('paymentHistory');
  const memberName = document.getElementById('memberName');
  const memberEmail = document.getElementById('memberEmail');
  const memberStatus = document.getElementById('memberStatus');
  const educationList = document.getElementById('educationList');
  const experienceList = document.getElementById('experienceList');

  // Membership fee table (amounts in NGN)
  // Includes common spelling variants imported from legacy registry (e.g. "Fellows" vs "Fellow")
  const membershipFees = {
    "Student Member": 500,
    "Graduate Member": 1000,
    "Associate Member": 2000,
    "Fellow": 10000,
    "Fellows": 10000,
    "Corporate Member": 5000,
    "Corporate Organization Member": 20000
  };

  // ── NIEE administrative/membership year ──────────────────────────────────
  // The admin year runs July 1 – June 30. A payment made any time before
  // July 1 of year Y falls in the (Y-1)/Y cycle; from July 1 of year Y it
  // falls in the Y/(Y+1) cycle. `year` stored on a payment record is always
  // the START year of its cycle (e.g. 2026 for the "2026/2027" cycle).
  function membershipYearStart(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    return d.getMonth() >= 6 ? y : y - 1; // getMonth() 6 === July
  }
  function membershipYearLabel(date) {
    const start = membershipYearStart(date);
    return `${start}/${start + 1}`;
  }
  // Display helper for a payment record's `year` field: membership dues show
  // as a "2026/2027" cycle label; one-off registration fees show as-is.
  function formatPaymentCycle(p) {
    if (p.type === 'registration' || p.type === 'registration_topup') {
      return p.year || 'One-time';
    }
    return p.year ? `${p.year}/${Number(p.year) + 1}` : '—';
  }

  // Free-text "state" fields collect inconsistent casing/suffixes over time
  // (e.g. "KADUNA", "Kaduna", "Lagos state") plus several FCT spellings.
  // Normalize for grouping so the revenue-by-state breakdown doesn't fragment.
  const STATE_ALIASES = {
    'fct': 'FCT (Abuja)',
    'abuja': 'FCT (Abuja)',
    'abuja capital territory': 'FCT (Abuja)',
    'federal capital territory': 'FCT (Abuja)'
  };
  function normalizeStateName(raw) {
    let s = (raw || '').trim();
    if (!s) return 'Unknown';
    s = s.replace(/\s+state$/i, '').trim();
    const alias = STATE_ALIASES[s.toLowerCase()];
    if (alias) return alias;
    return s.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  let currentUserUID = null;
  let userEmail = '';

  // ============================================================================
  // PASSWORD VALIDATION & SECURITY
  // ============================================================================
  // Password validation helper - enforces strong password requirements
  function validatePassword(password) {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    return null;
  }

  // Email validation helper
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Phone validation helper (basic international format)
  function validatePhone(phone) {
    const phoneRegex = /^[0-9\s+\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  // Register
  if (registerForm) {
    const passwordInput = document.getElementById('password');
    const passwordStrength = document.getElementById('passwordStrength');
    
    // Real-time password validation feedback
    if (passwordInput && passwordStrength) {
      passwordInput.addEventListener('input', () => {
        const error = validatePassword(passwordInput.value);
        if (error) {
          passwordStrength.textContent = '✗ ' + error;
          passwordStrength.className = 'text-danger small';
        } else if (passwordInput.value) {
          passwordStrength.textContent = '✓ Password is strong';
          passwordStrength.className = 'text-success small';
        } else {
          passwordStrength.textContent = '';
        }
      });
    }
    
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email')?.value?.trim() || '';
      const password = document.getElementById('password')?.value || '';
      
      // Validate email format
      if (!validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
      }
      
      // Validate password strength
      const passError = validatePassword(password);
      if (passError) {
        alert(passError);
        return;
      }
      
      // Disable button to prevent double-submit
      registerForm.querySelector('button[type="submit"]').disabled = true;
      
      createUserWithEmailAndPassword(auth, email, password)
        .then(() => window.location.href = 'membership-form.html')
        .catch(err => {
          if (err.code === 'auth/email-already-in-use') {
            alert('This email is already registered. Please login instead.');
          } else if (err.code === 'auth/weak-password') {
            alert('Password is too weak. Please use a stronger password.');
          } else if (err.code === 'auth/invalid-email') {
            alert('Invalid email address.');
          } else {
            alert('Registration failed: ' + (err.message || 'Unknown error'));
          }
          registerForm.querySelector('button[type="submit"]').disabled = false;
        });
    });
  }

  // Google sign-in removed; using email/password only

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value?.trim() || '';
      const password = document.getElementById('loginPassword')?.value || '';
      
      if (!email || !password) {
        alert('Please enter email and password');
        return;
      }
      
      // Disable button to prevent double-submit
      loginForm.querySelector('button[type="submit"]').disabled = true;
      
      signInWithEmailAndPassword(auth, email, password)
        .then(async (cred) => {
          const uid = cred.user.uid;
          try {
            const snap = await get(ref(db, `members/${uid}`));
            if (!snap.exists()) window.location.href = 'membership-form.html';
            else window.location.href = 'dashboard.html';
          } catch (err) {
            console.error('Error checking member status:', err);
            alert('Could not load profile. Please try again.');
            loginForm.querySelector('button[type="submit"]').disabled = false;
          }
        })
        .catch(err => {
          if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            alert('Incorrect email or password');
          } else if (err.code === 'auth/too-many-requests') {
            alert('Too many login attempts. Please try again later.');
          } else if (err.code === 'auth/invalid-email') {
            alert('Invalid email address.');
          } else {
            alert('Login failed: ' + (err.message || 'Unknown error'));
          }
          loginForm.querySelector('button[type="submit"]').disabled = false;
        });
    });
  }

  // Forgot password
  const sendResetBtn = document.getElementById('sendResetBtn');
  if (sendResetBtn) {
    sendResetBtn.addEventListener('click', async () => {
      const email = document.getElementById('resetEmail')?.value?.trim() || '';
      const msgEl = document.getElementById('resetMessage');
      if (!email) {
        msgEl.innerHTML = '<div class="alert alert-warning py-2 mb-2" style="font-size:.85rem;">Please enter your email address.</div>';
        return;
      }
      sendResetBtn.disabled = true;
      sendResetBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Sending…';
      try {
        await sendPasswordResetEmail(auth, email);
        msgEl.innerHTML = '<div class="alert alert-success py-2 mb-2" style="font-size:.85rem;"><i class="bi bi-check-circle me-1"></i>Reset link sent! Check your inbox (and spam folder).</div>';
        sendResetBtn.disabled = true;
        sendResetBtn.innerHTML = '<i class="bi bi-check me-1"></i>Sent';
      } catch (err) {
        const msg = err.code === 'auth/user-not-found' ? 'No account found with that email address.'
                  : err.code === 'auth/invalid-email'  ? 'Please enter a valid email address.'
                  : (err.message || 'Failed to send reset email. Please try again.');
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-2" style="font-size:.85rem;">${msg}</div>`;
        sendResetBtn.disabled = false;
        sendResetBtn.innerHTML = '<i class="bi bi-envelope me-1"></i>Send Reset Link';
      }
    });
  }

  // Admin sign-in form (separate page)
  const adminLoginForm = document.getElementById('adminLoginForm');
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmail')?.value || '';
      const password = document.getElementById('adminPassword')?.value || '';
      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          // redirect to admin dashboard; admin.html will enforce allowlist
          window.location.href = 'admin.html';
        })
        .catch(err => alert('Admin sign-in failed: ' + err.message));
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const redirectTarget = logoutBtn.getAttribute('data-redirect') || 'login.html';
      signOut(auth).then(() => window.location.href = redirectTarget);
    });
  }

  // Membership form submit (save profile, status Pending)
  if (membershipForm) {
    onAuthStateChanged(auth, user => {
      if (!user) { window.location.href = 'login.html'; return; }
      currentUserUID = user.uid;
      document.getElementById('email').value = user.email || '';
    });

    membershipForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUserUID) { alert('Please log in first.'); return; }
      
      // Validate declaration checkbox
      const declarationCheckbox = document.getElementById('declarationCheckbox');
      if (!declarationCheckbox || !declarationCheckbox.checked) {
        alert('You must accept the declaration to submit your membership form.');
        return;
      }
      
      // Disable submit button to prevent double-submit
      const submitBtn = membershipForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      
      try {
        // Validate phone format
        const phone = document.getElementById('phone')?.value?.trim() || '';
        if (!validatePhone(phone)) {
          alert('Please enter a valid phone number (at least 10 digits)');
          submitBtn.disabled = false;
          return;
        }

        // Validate email format
        const email = document.getElementById('email')?.value?.trim() || '';
        if (!validateEmail(email)) {
          alert('Please enter a valid email address');
          submitBtn.disabled = false;
          return;
        }

        // Validate chapter selection
        const chapterSelect = document.getElementById('chapter');
        if (!chapterSelect || !chapterSelect.value) {
          alert('Please select a chapter');
          submitBtn.disabled = false;
          return;
        }

        let chapterValue = chapterSelect.value;
        if (chapterValue === 'Others') {
          const chapterOthers = document.getElementById('chapterOthers')?.value?.trim() || '';
          if (!chapterOthers) {
            alert('Please specify your chapter name');
            submitBtn.disabled = false;
            return;
          }
          chapterValue = `Others: ${chapterOthers}`;
        }

        const education = [];
        document.querySelectorAll('#educationContainer .row').forEach(row => {
          const inst = row.querySelector('.institutionInput')?.value?.trim() || '';
          const deg = row.querySelector('.degreeInput')?.value?.trim() || '';
          const disc = row.querySelector('.disciplineInput')?.value?.trim() || '';
          const dates = row.querySelector('.datesInput')?.value?.trim() || '';
          if (inst || deg || disc || dates) {
            if (!inst || !deg || !disc || !dates) {
              throw new Error('Complete all Education fields for each entry.');
            }
            education.push({ institution: inst, degree: deg, discipline: disc, dates });
          }
        });
        if (education.length === 0) {
          throw new Error('Add at least one Education entry.');
        }

        const experience = [];
        document.querySelectorAll('#experienceContainer .row').forEach(row => {
          const inputs = row.querySelectorAll('input');
          if (inputs.length >= 5) {
            const title = inputs[0].value?.trim() || '';
            const duties = inputs[1].value?.trim() || '';
            const date = inputs[2].value?.trim() || '';
            const employer = inputs[3].value?.trim() || '';
            const employerAddress = inputs[4].value?.trim() || '';
            if (title || duties || date || employer || employerAddress) {
              if (!title || !duties || !date || !employer || !employerAddress) {
                throw new Error('Complete all Experience fields for each entry.');
              }
              experience.push({ title, duties, date, employer, employerAddress });
            }
          }
        });
        if (experience.length === 0) {
          throw new Error('Add at least one Experience entry.');
        }

        const data = {
          firstName: document.getElementById('firstName')?.value?.trim() || '',
          middleName: document.getElementById('middleName')?.value?.trim() || '',
          lastName: document.getElementById('lastName')?.value?.trim() || '',
          phone: phone,
          email: email,
          dob: document.getElementById('dob')?.value || '',
          gender: document.getElementById('gender')?.value || '',
          address: document.getElementById('address')?.value?.trim() || '',
          state: document.getElementById('state')?.value?.trim() || '',
          country: document.getElementById('country')?.value?.trim() || '',
          nationality: document.getElementById('nationality')?.value?.trim() || '',
          nseBranch: document.getElementById('nseBranch')?.value?.trim() || '',
          nseGrade: document.getElementById('nseGrade')?.value?.trim() || '',
          corenNumber: document.getElementById('corenNumber')?.value?.trim() || '',
          othermembershipNumber: document.getElementById('othermembershipNumber')?.value?.trim() || '',
          nextOfKin: {
            firstName: document.getElementById('nextFirstName')?.value?.trim() || '',
            middleName: document.getElementById('nextMiddleName')?.value?.trim() || '',
            lastName: document.getElementById('nextLastName')?.value?.trim() || '',
            email: document.getElementById('nextEmail')?.value?.trim() || '',
            phone: document.getElementById('nextPhone')?.value?.trim() || '',
            relationship: document.getElementById('nextRelationship')?.value?.trim() || ''
          },
          reference: {
            name: document.getElementById('refName')?.value?.trim() || '',
            email: document.getElementById('refEmail')?.value?.trim() || '',
            phone: document.getElementById('refPhone')?.value?.trim() || '',
            memberId: document.getElementById('refMemberId')?.value?.trim() || ''
          },
          education,
          experience,
          membershipNumber: document.getElementById('membershipNumber')?.value?.trim() || '',
          chapter: chapterValue,
          membershipType: document.getElementById('membershipType')?.value || '',
          submittedAt: new Date().toISOString()
        };

        // Preserve registry-linking fields if they already exist on this record
        const existingSnap = await get(ref(db, `members/${currentUserUID}`));
        const existing = existingSnap.val() || {};
        if (existing.nieeNumber) data.nieeNumber = existing.nieeNumber;
        if (existing.authUid)    data.authUid    = existing.authUid;

        const emailForPayment = auth.currentUser?.email || email;

        // Never charge the ₦1,000 registration fee twice: if a verified registration
        // payment already exists for this uid (e.g. a bank transfer that succeeded but a
        // previous session never made it back here to save the application), just save
        // the completed form and skip Paystack entirely.
        const priorPaymentsSnap = await get(ref(db, `payments/${currentUserUID}`));
        const priorPayments = Object.values(priorPaymentsSnap.val() || {});
        const alreadyPaidReg = priorPayments.find(p => p.type === 'registration' && p.verified);

        if (alreadyPaidReg) {
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving your application…';
          const finalData = { ...data, status: 'Registered', registrationPaidAt: new Date().toISOString() };
          try {
            await set(ref(db, `members/${currentUserUID}`), finalData);
            if (finalData.nieeNumber) {
              await update(ref(db, `members_registry/${finalData.nieeNumber}`), finalData);
            }
            await sendStatusEmail(emailForPayment, data.firstName, data.lastName, 'Registered', data.membershipType);
            alert('Registration submitted! Your ₦1,000 registration fee was already verified (ref: ' + alreadyPaidReg.reference + '), so no further payment is required. Your application is now under review.');
            window.location.href = 'dashboard.html';
          } catch (err) {
            console.error('Save error for pre-paid registration:', err);
            alert('Failed to save your application: ' + (err.message || 'Unknown error'));
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i>Submit &amp; Pay ₦1,000 Registration Fee';
          }
          return;
        }

        if (typeof PaystackPop === 'undefined') {
          alert('Payment system not loaded. Please refresh the page and try again.');
          submitBtn.disabled = false;
          return;
        }

        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Opening payment…';

        // Persist the filled-in application now, before payment, so it survives even if
        // the Paystack callback never fires in this browser (e.g. a bank transfer completed
        // from a different tab/device). Status flips to 'Registered' once payment is
        // confirmed, either by the callback below or by the server-side webhook.
        try {
          await set(ref(db, `members/${currentUserUID}`), { ...data, status: 'Pending' });
        } catch (err) {
          console.error('Pre-payment save error:', err);
          alert('Failed to save your application before payment: ' + (err.message || 'Unknown error'));
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i>Submit &amp; Pay ₦1,000 Registration Fee';
          return;
        }

        const handler = PaystackPop.setup({
          key: 'pk_live_2c2ea20bf7c7cbdd69e4b63d26da7059998a8e8f',
          email: emailForPayment,
          amount: 1000 * 100,
          currency: 'NGN',
          split_code: 'SPL_NNfUa4gYXW',
          metadata: { uid: currentUserUID, purpose: 'initial_registration' },
          callback: function(response) {
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving your application…';
            const finalData = { ...data, status: 'Registered', registrationPaidAt: new Date().toISOString() };
            set(ref(db, `members/${currentUserUID}`), finalData)
              .then(() => {
                if (finalData.nieeNumber) {
                  return update(ref(db, `members_registry/${finalData.nieeNumber}`), finalData);
                }
              })
              .then(() => {
                const paymentRef = push(ref(db, `payments/${currentUserUID}`));
                return set(paymentRef, {
                  reference: response.reference,
                  amount: 1000,
                  type: 'registration',
                  verified: true,
                  date: new Date().toISOString(),
                  email: emailForPayment
                });
              })
              .then(async () => {
                await sendStatusEmail(emailForPayment, data.firstName, data.lastName, 'Registered', data.membershipType);
                alert('Registration submitted and payment successful! Your application is now under review.');
                window.location.href = 'dashboard.html';
              })
              .catch(err => {
                console.error('Save error after payment:', err);
                alert('Payment received but there was an error saving your application. Please contact support with reference: ' + response.reference);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i>Submit &amp; Pay ₦1,000 Registration Fee';
              });
          },
          onClose: function() {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i>Submit &amp; Pay ₦1,000 Registration Fee';
          }
        });
        handler.openIframe();

      } catch (err) {
        console.error('Membership form error:', err);
        if (err.code === 'PERMISSION_DENIED') {
          alert('Permission denied. Please ensure you are logged in with the correct account.');
        } else if (err.code === 'NETWORK_ERROR') {
          alert('Network error. Please check your connection and try again.');
        } else {
          alert('Failed to submit: ' + (err.message || 'Unknown error'));
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i>Submit &amp; Pay ₦1,000 Registration Fee';
      }
    });
  }

  // Payment helpers
  window.showRegistrationFee = function(uid) {
    // Prefer the dedicated reg-fee slot in the new dashboard; fall back to paymentYears
    const regTarget = document.getElementById('regFeeAction') || paymentYears;
    if (!regTarget) return;
    const amount = 1000;
    regTarget.innerHTML = `
      <div class="payment-action-card">
        <div class="fee-label">One-Time Registration Fee</div>
        <div class="fee-amount">₦${amount.toLocaleString()}</div>
        <div class="fee-type">Required before your application is reviewed</div>
        <button class="btn btn-niee btn-sm mt-1" id="payRegistrationBtn">
          <i class="bi bi-credit-card me-1"></i>Pay ₦${amount.toLocaleString()}
        </button>
      </div>`;
    document.getElementById('payRegistrationBtn')?.addEventListener('click', () => payRegistration(uid, amount));
  };

  window.payRegistration = function(uid, amount) {
    if (typeof PaystackPop === 'undefined') return alert('Paystack not loaded');
    const emailForPayment = userEmail || (auth.currentUser && auth.currentUser.email) || '';
    if (!emailForPayment) return alert('No email available for payment');

    const handler = PaystackPop.setup({
      key: 'pk_live_2c2ea20bf7c7cbdd69e4b63d26da7059998a8e8f',
      email: emailForPayment,
      amount: amount * 100,
      currency: 'NGN',
      split_code: 'SPL_NNfUa4gYXW',
      metadata: { uid, purpose: 'registration_fee' },
      callback: function(response) {
        const paymentRef = push(ref(db, `payments/${uid}`));
        set(paymentRef, {
          reference: response.reference,
          amount,
          type: 'registration',
          verified: true,
          date: new Date().toISOString(),
          email: emailForPayment
        })
          .then(() => update(ref(db, `members/${uid}`), { status: 'Registered', registrationPaidAt: new Date().toISOString() }))
          .then(async () => {
            const snap = await get(ref(db, `members/${uid}`));
            const m = snap.val() || {};
            await sendStatusEmail(m.email || emailForPayment, m.firstName, m.lastName, 'Registered', m.membershipType);
            alert('Payment successful! Your application is now under review.');
            window.location.reload();
          })
          .catch(err => {
            console.error('Payment save error:', err);
            alert('Failed to save payment: ' + (err.message || 'Unknown error'));
          });
      },
      onClose: function() { 
        console.log('Payment dialog closed by user'); 
      }
    });
    handler.openIframe();
  };

  window.payNow = function(uid, amount, year, membershipType) {
    if (typeof PaystackPop === 'undefined') return alert('Paystack not loaded');
    // Resolve membershipType and amount defaults
    membershipType = membershipType || document.getElementById('membershipType')?.value || 'Corporate Member';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      amount = membershipFees[membershipType] || 0;
    }
    const emailForPayment = userEmail || (auth.currentUser && auth.currentUser.email) || '';
    if (!emailForPayment) return alert('No email available for payment');

    const handler = PaystackPop.setup({
      key: 'pk_live_2c2ea20bf7c7cbdd69e4b63d26da7059998a8e8f',
      email: emailForPayment,
      amount: amount * 100,
      currency: 'NGN',
      split_code: 'SPL_NNfUa4gYXW',
      metadata: { uid, membershipType, year, purpose: 'annual_dues' },
      callback: function(response) {
        const paymentRef = push(ref(db, `payments/${uid}`));
        set(paymentRef, {
          reference: response.reference,
          amount,
          year,
          membershipType,
          type: 'membership',
          verified: true,
          date: new Date().toISOString(),
          email: emailForPayment
        })
          .then(() => {
            alert('Payment successful! Your annual membership dues have been recorded.');
            window.location.reload();
          })
          .catch(err => {
            console.error('Payment save error:', err);
            alert('Failed to save payment: ' + (err.message || 'Unknown error'));
          });
      },
      onClose: function() { 
        console.log('Payment dialog closed by user'); 
      }
    });
    handler.openIframe();
  };

  // Render a membership payment card for a given membershipType (uses membershipFees)
  // priorPayments: array of existing payment objects used to detect first corporate annual payment
  // isImported: true for members who came through the legacy registry (member-update.html) —
  //             they are already registered so no first-year ₦15,000 premium applies (always ₦5,000)
  window.showMembershipFee = function(uid, membershipType, priorPayments, isImported) {
    if (!paymentYears) return;
    const cycleStart = membershipYearStart(new Date());
    const cycleLabel = membershipYearLabel(new Date());
    const isCorp = (membershipType || '').toLowerCase().includes('corporate');
    // First-year ₦15,000 premium only applies to NEW portal-registered corporate members
    const hasPriorCorpAnnual = isCorp && (priorPayments || []).some(
      p => p.type === 'membership' && p.verified && (p.membershipType || '').toLowerCase().includes('corporate')
    );
    const isFirstCorpYear = !isImported && isCorp && !hasPriorCorpAnnual;
    const baseAmount = membershipFees[membershipType] || 0;
    const amount = isFirstCorpYear ? 15000 : baseAmount;
    const feeNote = isFirstCorpYear
      ? 'First-year corporate annual dues'
      : `Annual dues for ${cycleLabel}`;
    paymentYears.innerHTML = '';
    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `
      <div class="payment-action-card">
        <div class="fee-label">${membershipType}</div>
        <div class="fee-amount">₦${amount.toLocaleString()}</div>
        <div class="fee-type">${feeNote}</div>
        <button class="btn btn-niee btn-sm mt-1" id="payMembershipNowBtn">
          <i class="bi bi-credit-card me-1"></i>Pay ₦${amount.toLocaleString()}
        </button>
      </div>`;
    paymentYears.appendChild(col);
    document.getElementById('payMembershipNowBtn')?.addEventListener('click', () => payNow(uid, amount, cycleStart, membershipType));
  };

  // ── Status Steps driver ────────────────────────────────────
  function updateStatusSteps(data) {
    const status = (data.status || 'Pending').toLowerCase();
    const steps = ['step1','step2','step3','step4','step5'].map(id => document.getElementById(id));
    if (!steps[0]) return; // not on dashboard
    steps.forEach(s => { if (s) { s.classList.remove('done','active'); } });
    // Step 1: always done (signed in)
    steps[0].classList.add('done');

    // Imported/existing members came through member-update (not the application form).
    // Skip the "submit application" step — mark all history steps as done and jump to status.
    const isImported = !!(data.nieeNumber) && !data.submittedAt;
    if (isImported) {
      steps[1].classList.add('done');  // registration form
      steps[2].classList.add('done');  // payment
      if (status === 'approved') {
        steps[3].classList.add('done');
        steps[4].classList.add('done');
      } else if (status === 'rejected') {
        steps[3].classList.add('done');
        const icon = steps[4].querySelector('.niee-step-icon');
        if (icon) icon.style.background = '#dc3545';
        const lbl = steps[4].querySelector('.niee-step-label');
        if (lbl) lbl.textContent = 'Rejected';
      } else {
        steps[3].classList.add('active');
      }
      return;
    }

    // Step 2: form submitted (new portal registrants)
    if (data.submittedAt) {
      steps[1].classList.add('done');
    } else {
      steps[1].classList.add('active');
      return;
    }
    // Step 3 & 4 are updated when payments load (see payment gate logic)
    if (status === 'pending') {
      steps[2].classList.add('active');
      return;
    }
    steps[2].classList.add('done');
    if (status === 'registered') {
      steps[3].classList.add('active');
      return;
    }
    steps[3].classList.add('done');
    if (status === 'approved') {
      steps[4].classList.add('done');
    } else if (status === 'rejected') {
      const icon = steps[4].querySelector('.niee-step-icon');
      if (icon) icon.style.background = '#dc3545';
      const lbl = steps[4].querySelector('.niee-step-label');
      if (lbl) lbl.textContent = 'Rejected';
    }
  }

  // ── Receipt PDF generator ────────────────────────────────────
  async function downloadReceipt(entry, memberData) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { alert('PDF library not loaded. Please refresh and try again.'); return; }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const green  = [0, 102, 51];
    const lightG = [230, 245, 236];
    const gray   = [100, 100, 100];
    const dark   = [30, 30, 30];

    // ── Load logo ────────────────────────────────────────────
    let logoDataUrl = null;
    try {
      const resp = await fetch('niee-logo.jpg');
      const blob = await resp.blob();
      logoDataUrl = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (_) { /* logo optional */ }

    // ── Header bar ───────────────────────────────────────────
    doc.setFillColor(...green);
    doc.rect(0, 0, pageW, 38, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'JPEG', 10, 5, 28, 28);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT RECEIPT', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Nigerian Institution of Environmental Engineers', pageW / 2, 26, { align: 'center' });
    doc.text('nieeportal.web.app', pageW / 2, 32, { align: 'center' });

    // ── Receipt meta (right-aligned) ─────────────────────────
    const issueDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
    doc.setTextColor(...dark);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Issue Date: ${issueDate}`, pageW - 14, 46, { align: 'right' });
    doc.text(`Reference:  ${entry.reference || '—'}`, pageW - 14, 52, { align: 'right' });

    // ── "Issued to" block ────────────────────────────────────
    doc.setFillColor(...lightG);
    doc.roundedRect(14, 58, pageW - 28, 28, 3, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gray);
    doc.text('ISSUED TO', 20, 66);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    const fullName = [memberData?.firstName, memberData?.lastName].filter(Boolean).join(' ') || '—';
    doc.text(fullName, 20, 74);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    const nieeNum = memberData?.nieeNumber || '—';
    doc.text(`NIEE No: ${nieeNum}`, 20, 81);

    // ── Payment details table ────────────────────────────────
    let y = 98;
    const labelX = 20;
    const valueX = 100;

    function drawRow(label, value, highlight) {
      if (highlight) {
        doc.setFillColor(...lightG);
        doc.rect(14, y - 5, pageW - 28, 10, 'F');
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...gray);
      doc.text(label, labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...dark);
      doc.text(String(value), valueX, y);
      y += 12;
    }

    const payType  = entry.type === 'registration' ? 'One-Time Registration Fee' : entry.type === 'registration_topup' ? 'Registration Balance (Top-up)' : 'Annual Membership Dues';
    const yearVal  = (entry.type === 'registration' || entry.type === 'registration_topup') ? 'One-time (non-recurring)' : (String(entry.year || '—'));
    const amountFmt = entry.amount ? '₦' + Number(entry.amount).toLocaleString('en-NG') : '—';
    const payDate  = entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }) : '—';
    const statusTxt = entry.verified ? 'Verified' : 'Pending Verification';
    const memType  = memberData?.membershipType || '—';

    drawRow('Payment Type',       payType,    false);
    drawRow('Membership Grade',   memType,    true);
    drawRow('Amount Paid',        amountFmt,  false);
    drawRow('Payment Year',       yearVal,    true);
    drawRow('Payment Date',       payDate,    false);
    drawRow('Transaction Reference', entry.reference || '—', true);
    drawRow('Payment Status',     statusTxt,  false);

    // ── Divider ──────────────────────────────────────────────
    doc.setDrawColor(...green);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageW - 14, y);
    y += 8;

    // ── Verified stamp ───────────────────────────────────────
    if (entry.verified) {
      doc.setTextColor(...green);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('✓  VERIFIED', pageW / 2, y + 10, { align: 'center' });
      y += 22;
    }

    // ── Footer ───────────────────────────────────────────────
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...gray);
    doc.text('This is an official NIEE payment receipt. For enquiries contact the NIEE secretariat.', pageW / 2, 278, { align: 'center' });
    doc.setDrawColor(...green);
    doc.setLineWidth(0.8);
    doc.line(14, 281, pageW - 14, 281);

    const filename = `NIEE-Receipt-${entry.reference || entry.type || 'payment'}.pdf`;
    doc.save(filename);
  }

  // ── Certificate PDF generator ────────────────────────────────
  async function downloadCertificate(memberData) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { alert('PDF library not loaded. Please refresh and try again.'); return; }

    const nieeNo = memberData.nieeNumber || '';

    // ── Select template based on membership type ────────────────
    const type = (memberData.membershipType || '').toLowerCase();
    let templateFile = 'cert-corporate.jpg'; // default
    if (type.includes('fellow'))                       templateFile = 'cert-fellow.jpg';
    else if (type.includes('graduate'))                templateFile = 'cert-graduate.jpg';
    else if (type.includes('student'))                 templateFile = 'cert-student.jpg';
    else if (type.includes('organization'))            templateFile = 'cert-corporate.jpg';
    else if (type.includes('associate'))               templateFile = 'cert-associate.jpg';
    else if (type.includes('corporate') || type.includes('member')) templateFile = 'cert-corporate.jpg';

    // ── Load certificate template image ────────────────────────
    let templateDataUrl = null;
    try {
      const resp = await fetch(templateFile);
      const blob = await resp.blob();
      templateDataUrl = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (_) { /* template optional */ }

    // ── PDF setup (portrait A4: 210 × 297 mm) ──────────────────
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = 210, H = 297;

    // ── Background template ─────────────────────────────────────
    if (templateDataUrl) {
      doc.addImage(templateDataUrl, 'JPEG', 0, 0, W, H);
    }

    // ── Full name ───────────────────────────────────────────────
    const fullName = [memberData.firstName, memberData.middleName, memberData.lastName]
      .filter(Boolean).join(' ') || '—';

    doc.setTextColor(25, 25, 25);

    const isFellow = templateFile === 'cert-fellow.jpg';

    // ── Name — use Times Bold Italic to match certificate script style ──
    const nameY = isFellow ? 87 : 143;
    doc.setFontSize(isFellow ? 22 : 18);
    doc.setFont('times', 'bolditalic');
    doc.text(fullName, W / 2, nameY, { align: 'center' });

    // ── Date & NIEE number ───────────────────────────────────────
    const approvalDate = memberData.reviewedAt ? new Date(memberData.reviewedAt) : new Date();
    const day   = approvalDate.getDate();
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const month = months[approvalDate.getMonth()];
    const yr    = approvalDate.getFullYear();

    // Fellow: place date/NIEE above the signature lines (~200mm); other templates slightly lower
    const dateY   = isFellow ? 200 : 248;
    const nieeNoY = dateY + 9;

    doc.setFontSize(13);
    doc.setFont('times', 'bold');
    doc.setTextColor(25, 25, 25);
    doc.text(`Dated: ${day} ${month} ${yr}`, W / 2, dateY, { align: 'center' });
    doc.text(`NIEE No:  ${nieeNo || '—'}`, W / 2, nieeNoY, { align: 'center' });

    const filename = `NIEE-Certificate-${nieeNo || 'membership'}.pdf`;
    doc.save(filename);
  }

  // ── Payments view ───────────────────────────────────────────
  function renderPayments(uid, memberData) {
    const payRef = ref(db, `payments/${uid}`);
    onValue(payRef, snapshot => {
      const data = snapshot.val() || {};
      const entries = Object.values(data);
      if (paymentTableBody) paymentTableBody.innerHTML = '';
      const noHistoryEl = document.getElementById('noPaymentHistory');

      entries.slice().reverse().forEach(entry => {
        const row = document.createElement('tr');
        const verified = !!entry.verified;
        const statusBadge = verified
          ? '<span class="badge bg-success">Verified</span>'
          : '<span class="badge bg-warning text-dark">Pending</span>';
        const typeLabel = entry.type === 'registration'
          ? '<span class="niee-table-label label-registration">Registration</span>'
          : entry.type === 'registration_topup'
          ? '<span class="niee-table-label label-registration" style="background:#f59e0b;">Reg. Balance</span>'
          : `<span class="niee-table-label label-membership">Annual</span>`;
        const yearCol = (entry.type === 'registration' || entry.type === 'registration_topup') ? 'One-time' : (entry.year || '—');
        const amountFmt = entry.amount ? '₦' + Number(entry.amount).toLocaleString() : '—';
        row.innerHTML = `
          <td>${typeLabel}</td>
          <td style="font-size:.8rem;font-family:monospace;">${entry.reference || '—'}</td>
          <td>${amountFmt}</td>
          <td>${yearCol}</td>
          <td>${statusBadge}</td>
          <td>${entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : '—'}</td>
          <td><button class="btn btn-outline-secondary btn-sm py-0 px-2 download-receipt-btn" style="font-size:.75rem;" title="Download Receipt"><i class="bi bi-download me-1"></i>Receipt</button></td>
        `;
        const receiptBtn = row.querySelector('.download-receipt-btn');
        if (receiptBtn) receiptBtn.addEventListener('click', () => downloadReceipt(entry, memberData));
        paymentTableBody && paymentTableBody.appendChild(row);
      });

      const hasPayments = entries.length > 0;
      if (paymentHistory) paymentHistory.classList.toggle('d-none', !hasPayments);
      if (noHistoryEl) noHistoryEl.style.display = hasPayments ? 'none' : '';
    });
  }

  // Dashboard population
  const isAdminPage = window.location.pathname.endsWith('admin.html') || window.location.href.includes('/admin.html');

  onAuthStateChanged(auth, user => {
    // If this is the admin page, enforce ADMIN_ALLOWLIST if provided
    if (isAdminPage) {
      if (!user) {
        // not signed in -> go to login
        window.location.href = 'login.html';
        return;
      }
      // Check both client-side allowlist and server-managed /admins/{uid} flag
      (async () => {
        try {
          const allow = window.ADMIN_ALLOWLIST || [];
          const email = (user && user.email) || '';
          const uid   = (user && user.uid)   || '';
          let isAllowed = false;
          // match by email (case-insensitive) or UID
          if (Array.isArray(allow) && allow.length > 0) {
            const normalized = String(email).toLowerCase();
            const lowerAllow = allow.map(a => String(a || '').toLowerCase());
            if (lowerAllow.includes(normalized)) isAllowed = true;
            if (allow.includes(uid)) isAllowed = true;
          }
          // check server-side admins flag in RTDB (this is authoritative if present)
          try {
            const adminSnap = await get(ref(db, `admins/${user.uid}`));
            if (adminSnap.exists() && adminSnap.val() === true) isAllowed = true;
          } catch (dbErr) {
            // It's common for clients to be denied read access to the central `/admins` path
            // if you manage admin flags server-side. Treat permission errors as a non-fatal
            // condition and avoid noisy warnings in the console. Log only at debug level
            // so developers can still inspect it when necessary.
            try {
              const code = (dbErr && dbErr.code) ? String(dbErr.code).toLowerCase() : '';
              if (code.includes('permission') || code.includes('denied')) {
                console.debug('Insufficient permission to read /admins flag (expected in some setups).');
              } else {
                console.error('Unexpected error reading /admins flag:', dbErr.message || dbErr);
              }
            } catch (inner) {
              console.debug('Could not read /admins flag; error was:', String(dbErr));
            }
          }
              if (!isAllowed) {
                alert('You do not have permission to access the admin portal.');
                window.location.href = 'dashboard.html';
                return;
              }
              // initialize the admin page now that access is confirmed
              try { initAdminPage(); } catch (e) { console.warn('initAdminPage call failed', e); }
        } catch (err) {
          console.error('Admin check failed', err);
          // default to redirecting to login/dashboard for safety
          window.location.href = 'dashboard.html';
        }
      })();
    }
    if (!user) return;
    currentUserUID = user.uid;
    userEmail = user.email || '';
    const userRef = ref(db, `members/${currentUserUID}`);
    onValue(userRef, snap => {
      const data = snap.val() || {};
      if (memberName) memberName.textContent = `${data.firstName || ''} ${data.lastName || ''}`;
      if (memberEmail) memberEmail.textContent = data.email || user.email || '';
      if (memberStatus) memberStatus.textContent = data.status || 'Pending';
      // dashboard header fields
      const memberNameHeader = document.getElementById('memberNameHeader');
      const memberEmailHeader = document.getElementById('memberEmailHeader');
      const memberDOB = document.getElementById('memberDOB');
      const memberGender = document.getElementById('memberGender');
      const memberPhone = document.getElementById('memberPhone');
      const memberAddress = document.getElementById('memberAddress');
      const memberMembershipNumber = document.getElementById('memberMembershipNumber');
      const memberChapter = document.getElementById('memberChapter');
      const memberState = document.getElementById('memberState');
      const memberCountry = document.getElementById('memberCountry');
      const memberNationality = document.getElementById('memberNationality');
      const memberTypeEl = document.getElementById('memberType');
      if (memberNameHeader) memberNameHeader.textContent = `${data.firstName || ''} ${data.lastName || ''}`;
      if (memberEmailHeader) memberEmailHeader.textContent = data.email || user.email || '';
      if (memberDOB) memberDOB.textContent = data.dob || '-';
      if (memberGender) memberGender.textContent = data.gender || '-';
      if (memberPhone) memberPhone.textContent = data.phone || '-';
      if (memberAddress) memberAddress.textContent = data.address || '-';
      if (memberMembershipNumber) memberMembershipNumber.textContent = data.membershipNumber || '-';
      if (memberChapter) memberChapter.textContent = data.chapter || '-';
      if (memberState) memberState.textContent = data.state || '-';
      if (memberCountry) memberCountry.textContent = data.country || '-';
      if (memberNationality) memberNationality.textContent = data.nationality || '-';
      if (memberTypeEl) memberTypeEl.textContent = data.membershipType || '-';
      if (educationList) educationList.innerHTML = (data.education || []).map(e =>
        `<li class="mb-1"><i class="bi bi-mortarboard me-1 text-niee" style="font-size:.8rem;"></i>${e.degree || ''} ${e.discipline ? '<span class="text-muted">('+e.discipline+')</span>' : ''} &mdash; ${e.institution || ''} <span class="text-muted">(${e.dates || ''})</span></li>`
      ).join('') || '<li class="text-muted">No education records</li>';
      if (experienceList) experienceList.innerHTML = (data.experience || []).map(e =>
        `<li class="mb-1"><i class="bi bi-briefcase me-1 text-niee" style="font-size:.8rem;"></i>${e.title || ''} <span class="text-muted">at ${e.employer || ''}${e.employerAddress ? ', ' + e.employerAddress : ''}</span> <span class="text-muted">(${e.date || ''})</span></li>`
      ).join('') || '<li class="text-muted">No experience records</li>';

      // Avatar initials
      const avatarEl = document.getElementById('memberAvatar');
      if (avatarEl) {
        const initials = ((data.firstName || '?')[0] + (data.lastName || '?')[0]).toUpperCase();
        avatarEl.textContent = initials;
      }

      // Sidebar quick-info
      const sidebarPhoneEl = document.getElementById('sidebarPhone');
      const sidebarChapterEl = document.getElementById('sidebarChapter');
      const sidebarJoinedEl = document.getElementById('sidebarJoined');
      if (sidebarPhoneEl) sidebarPhoneEl.textContent = data.phone || '—';
      if (sidebarChapterEl) sidebarChapterEl.textContent = data.chapter || '—';
      if (sidebarJoinedEl) sidebarJoinedEl.textContent = data.submittedAt
        ? new Date(data.submittedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
        : '—';

      // Next of Kin panel
      const nokEl = document.getElementById('nextOfKinInfo');
      if (nokEl) {
        const nok = data.nextOfKin || {};
        const hasNok = nok.firstName || nok.lastName || nok.phone;
        nokEl.innerHTML = hasNok ? `
          <div class="info-grid">
            <div class="info-item"><label>Name</label><span>${[nok.firstName, nok.middleName, nok.lastName].filter(Boolean).join(' ') || '—'}</span></div>
            <div class="info-item"><label>Phone</label><span>${nok.phone || '—'}</span></div>
            <div class="info-item"><label>Email</label><span>${nok.email || '—'}</span></div>
            <div class="info-item"><label>Relationship</label><span>${nok.relationship || '—'}</span></div>
          </div>` : '<span class="text-muted" style="font-size:.88rem;">Not provided</span>';
      }

      // Reference panel
      const refInfoEl = document.getElementById('referenceInfo');
      if (refInfoEl) {
        const refData = data.reference || {};
        const hasRef = refData.name || refData.email || refData.phone;
        refInfoEl.innerHTML = hasRef ? `
          <div class="info-grid">
            <div class="info-item"><label>Name</label><span>${refData.name || '—'}</span></div>
            <div class="info-item"><label>Email</label><span>${refData.email || '—'}</span></div>
            <div class="info-item"><label>Phone</label><span>${refData.phone || '—'}</span></div>
            <div class="info-item"><label>Member ID</label><span>${refData.memberId || '—'}</span></div>
          </div>` : '<span class="text-muted" style="font-size:.88rem;">Not provided</span>';
      }

      // Status badge styling
      if (memberStatus) {
        const s = (data.status || 'Pending').toLowerCase();
        memberStatus.className = 'status-badge';
        if (s === 'approved') memberStatus.classList.add('status-approved');
        else if (s === 'rejected') memberStatus.classList.add('status-rejected');
        else if (s === 'registered') memberStatus.classList.add('status-awaiting');
        else memberStatus.classList.add('status-pending');
        memberStatus.textContent = data.status || 'Pending';
      }

      // Drive membership status steps
      updateStatusSteps(data);

      renderPayments(currentUserUID, data);

      // ── Certificate section ───────────────────────────────────
      const certNavLink = document.getElementById('certNavLink');
      const certBtn     = document.getElementById('downloadCertBtn');
      if (data.nieeNumber && (data.status || '').toLowerCase() === 'approved') {
        // Reveal sidebar nav link
        if (certNavLink) certNavLink.classList.remove('d-none');
        // Populate preview fields
        const previewName = document.getElementById('certPreviewName');
        const previewType = document.getElementById('certPreviewType');
        const previewNo   = document.getElementById('certPreviewNo');
        if (previewName) previewName.textContent = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ') || '—';
        if (previewType) previewType.textContent = data.membershipType || '—';
        if (previewNo)   previewNo.textContent   = data.nieeNumber;
        // Wire download button (replace clone to avoid double-binding)
        if (certBtn) {
          const freshBtn = certBtn.cloneNode(true);
          certBtn.parentNode.replaceChild(freshBtn, certBtn);
          freshBtn.addEventListener('click', () => downloadCertificate(data));
        }
      }

      // show registration fee if no registration payment, otherwise show annual membership fee
      get(ref(db, `payments/${currentUserUID}`)).then(s => {
        const payments = s.val() || {};
        const values = Object.values(payments);
        const cycleStart = membershipYearStart(new Date());
        const cycleLabel = membershipYearLabel(new Date());
        const nextCycleStart = cycleStart + 1;
        const regPaidVerified = values.some(p => p.type === 'registration' && p.verified);
        const regPaymentExists = values.some(p => p.type === 'registration');
        const membershipPaidThisYear = values.some(p => p.type === 'membership' && Number(p.year) === cycleStart);

        const paymentSection = document.getElementById('paymentYears');
        const headerPayBtn = document.getElementById('payMembershipBtn');

        // Helper: show registration fee paid badge in new dashboard
        function markRegFeePaid(verified) {
          const regAction = document.getElementById('regFeeAction');
          const regBadge = document.getElementById('regFeeStatusBadge');
          if (regAction) {
            regAction.innerHTML = verified
              ? `<div class="text-center"><span class="status-badge status-approved"><i class="bi bi-check-circle me-1"></i>Paid & Verified</span></div>`
              : `<div class="text-center"><span class="status-badge status-awaiting"><i class="bi bi-hourglass me-1"></i>Payment Received — Verifying</span></div>`;
          }
          if (regBadge) {
            regBadge.style.display = '';
            regBadge.className = 'status-badge ' + (verified ? 'status-approved' : 'status-awaiting');
            regBadge.textContent = verified ? 'Paid' : 'Pending Verification';
          }
        }

        // Any member with a nieeNumber has completed the registration process — they must
        // never be asked to pay the ₦1,000 registration fee again.
        const isImportedMember = !!(data.nieeNumber);

        // Legacy registry members came through member-update.html (no submittedAt).
        // They are ALREADY registered members so the corporate first-year ₦15,000 premium
        // does NOT apply — they always pay the flat annual rate (₦5,000 for corporate).
        // New portal registrants (have submittedAt) pay ₦15,000 on their first corporate year,
        // regardless of what membership type they originally applied under.
        const isLegacyMember = !!(data.nieeNumber) && !data.submittedAt;

        if (isImportedMember) {
          // Existing/imported members: mark reg fee as paid (pre-portal or already paid at submission)
          // Use the actual payment record if available, otherwise treat as paid by default.
          markRegFeePaid(regPaidVerified || true);
        } else {
          const memberStatusLower = (data.status || 'pending').toLowerCase();

          // Incomplete application — member never paid registration fee
          if (memberStatusLower === 'pending') {
            const regAction = document.getElementById('regFeeAction');
            const regBadge = document.getElementById('regFeeStatusBadge');
            if (regAction) regAction.innerHTML = `
              <div class="alert alert-warning mb-0" style="font-size:.88rem;">
                <i class="bi bi-exclamation-triangle me-1"></i>
                Your application is incomplete. Please
                <a href="membership-form.html" class="alert-link fw-semibold">return to the registration form</a>
                to submit your application and pay the ₦1,000 registration fee.
              </div>`;
            if (regBadge) { regBadge.style.display = ''; regBadge.className = 'status-badge status-pending'; regBadge.textContent = 'Incomplete'; }
            if (paymentSection) paymentSection.innerHTML = '<div class="col-12 text-muted" style="font-size:.88rem;"><i class="bi bi-lock me-1"></i>Annual dues will be available once your application is submitted and approved.</div>';
            if (headerPayBtn) { headerPayBtn.disabled = true; headerPayBtn.textContent = 'Application incomplete'; }
            return;
          }

          // Registration fee was paid at form submission — mark as paid
          markRegFeePaid(regPaidVerified || true);
        }

        // Gate by member status
        const isApproved = isImportedMember || (data.status || '').toLowerCase() === 'approved';

        if (!isApproved) {
          if (paymentSection) paymentSection.innerHTML = '<div class="col-12"><div class="alert alert-info mb-0"><i class="bi bi-person-check me-2"></i>Your application is under admin review. Annual dues will be available once approved.</div></div>';
          if (headerPayBtn) { headerPayBtn.disabled = true; headerPayBtn.textContent = 'Awaiting approval'; }
          return;
        }

        // Approved member: show upcoming/paid notice for this year
        const annualBadge = document.getElementById('annualFeeStatusBadge');
        if (membershipPaidThisYear) {
          if (paymentSection) paymentSection.innerHTML = `<div class="col-12"><div class="alert alert-success mb-0"><i class="bi bi-check-circle me-2"></i>Annual membership dues for <strong>${cycleLabel}</strong> are paid. Next payment due: <strong>July ${nextCycleStart}</strong>.</div></div>`;
          if (annualBadge) { annualBadge.style.display = ''; annualBadge.className = 'status-badge status-approved'; annualBadge.textContent = cycleLabel + ' Paid'; }
          if (headerPayBtn) { headerPayBtn.disabled = true; headerPayBtn.textContent = `Paid for ${cycleLabel}`; }
          // Show upcoming payment card
          const upcomingCard = document.getElementById('upcomingPaymentCard');
          const upcomingBody = document.getElementById('upcomingPaymentBody');
          const fee = membershipFees[data.membershipType] || 0;
          if (upcomingCard) upcomingCard.classList.remove('d-none');
          if (upcomingBody) upcomingBody.innerHTML = `<i class="bi bi-calendar-event me-2 text-niee"></i>Your next annual due of <strong>₦${fee.toLocaleString()}</strong> (${data.membershipType}) will be due in <strong>July ${nextCycleStart}</strong>.`;
          return;
        }

        // Approved, not yet paid this cycle: show pay card
        showMembershipFee(currentUserUID, data.membershipType || 'Corporate Member', values, isLegacyMember);
        if (annualBadge) { annualBadge.style.display = ''; annualBadge.className = 'status-badge status-pending'; annualBadge.textContent = cycleLabel + ' Due'; }
        if (headerPayBtn) {
          headerPayBtn.disabled = false;
          headerPayBtn.textContent = 'Pay Annual Dues';
          headerPayBtn.onclick = () => showMembershipFee(currentUserUID, data.membershipType || 'Corporate Member', values, isLegacyMember);
        }
      }).catch(() => {
        // fallback: block payment if we cannot read payment history
        const headerPayBtn = document.getElementById('payMembershipBtn');
        if (headerPayBtn) {
          headerPayBtn.disabled = true;
          headerPayBtn.textContent = 'Payments unavailable';
        }
      });
    });
  });

  // Admin page logic: load members and provide approve/reject controls
  async function initAdminPage() {
    if (!isAdminPage) return;
    const tableBody = document.querySelector('#membersTable tbody');
    if (!tableBody) {
      console.warn('Admin page: #membersTable tbody not found in DOM');
      return;
    }
    const statusFilter = document.getElementById('statusFilter');
    const exportBtn = document.getElementById('exportBtn');
    const modalEl = document.getElementById('memberModal');
    const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

    function renderMemberRow(uid, m) {
      const tr = document.createElement('tr');
      const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || '-';
      const email = m.email || '-';
      const phone = m.phone || '-';
      const type = m.membershipType || '-';
      const submitted = m.submittedAt ? new Date(m.submittedAt).toLocaleString() : '-';
      const chapter = m.chapter || '-';
      const status = m.status || 'Pending';
      tr.innerHTML = `
        <td class="align-middle text-center"><input type="checkbox" class="member-select" data-uid="${uid}" aria-label="select member"></td>
        <td class="align-middle">${name}</td>
        <td class="align-middle">${email}</td>
        <td class="align-middle">${phone}</td>
        <td class="align-middle" id="type-${uid}">
          <select class="form-select form-select-sm type-change-select" data-uid="${uid}" style="min-width:150px;">
            <option value=""                ${!type||type==='-'           ?'selected':''}>— not set —</option>
            <option value="Student Member"              ${type==='Student Member'              ?'selected':''}>Student Member</option>
            <option value="Graduate Member"             ${type==='Graduate Member'             ?'selected':''}>Graduate Member</option>
            <option value="Associate Member"            ${type==='Associate Member'            ?'selected':''}>Associate Member</option>
            <option value="Corporate Member"            ${type==='Corporate Member'            ?'selected':''}>Corporate Member</option>
            <option value="Fellow"                      ${type==='Fellow'                      ?'selected':''}>Fellow</option>
            <option value="Corporate Organization Member" ${type==='Corporate Organization Member'?'selected':''}>Corporate Organization Member</option>
          </select>
        </td>
        <td class="align-middle">${submitted}</td>
        <td class="align-middle">${chapter}</td>
        <td class="align-middle" id="status-${uid}">
          <select class="form-select form-select-sm status-change-select" data-uid="${uid}" style="min-width:130px;">
            <option value="Pending"          ${status==='Pending'          ?'selected':''}>Pending</option>
            <option value="Registered"       ${status==='Registered'       ?'selected':''}>Registered</option>
            <option value="Approved"         ${status==='Approved'         ?'selected':''}>Approved</option>
            <option value="Rejected"         ${status==='Rejected'         ?'selected':''}>Rejected</option>
          </select>
        </td>
        <td class="align-middle">
          <button class="btn btn-sm btn-outline-primary me-1" data-uid="${uid}" data-action="view">View</button>
          <button class="btn btn-sm btn-outline-success me-1" data-uid="${uid}" data-action="payments">Payments</button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-uid="${uid}" data-action="mark-annual-paid" title="Record manual annual dues payment"><i class="bi bi-cash-coin me-1"></i>Mark Paid</button>
          <button class="btn btn-sm btn-outline-warning me-1" data-uid="${uid}" data-action="remind" title="Send reminder email based on current status"><i class="bi bi-bell me-1"></i>Remind</button>
          <button class="btn btn-sm btn-danger" data-uid="${uid}" data-action="reject">Reject</button>
        </td>
      `;
      return tr;
    }

    function attachActions() {
      // wire membership type dropdown
      tableBody.querySelectorAll('.type-change-select').forEach(sel => {
        sel.addEventListener('change', async function() {
          const uid = this.dataset.uid;
          const newType = this.value;
          try {
            await update(ref(db, `members/${uid}`), { membershipType: newType, reviewedBy: userEmail, reviewedAt: new Date().toISOString() });
            const memberSnap = await get(ref(db, `members/${uid}`));
            const memberData = memberSnap.val() || {};
            if (memberData.email) {
              await sendStatusEmail(memberData.email, memberData.firstName, memberData.lastName, memberData.status, newType, memberData.nieeNumber);
            }
          } catch (err) {
            alert('Failed to update membership type: ' + (err.message || err));
            const snap = await get(ref(db, `members/${uid}`));
            if (snap.exists()) this.value = snap.val().membershipType || '';
          }
        });
      });

      // wire status dropdown
      tableBody.querySelectorAll('.status-change-select').forEach(sel => {
        sel.addEventListener('change', async function() {
          const uid = this.dataset.uid;
          const newStatus = this.value;
          try {
            const payload = { status: newStatus, reviewedBy: userEmail, reviewedAt: new Date().toISOString() };
            await update(ref(db, `members/${uid}`), payload);

            // Assign NIEE number when admin approves a member who doesn't have one yet
            if (newStatus === 'Approved') {
              const memberSnap = await get(ref(db, `members/${uid}`));
              const memberData = memberSnap.val() || {};
              let resolvedNieeNumber = memberData.nieeNumber;
              if (!resolvedNieeNumber) {
                const txResult = await runTransaction(ref(db, 'niee_counter'), current => (current || 927) + 1);
                const nextNum = txResult.snapshot.val();
                resolvedNieeNumber = 'NIEE' + String(nextNum).padStart(8, '0');
                await update(ref(db, `members/${uid}`), { nieeNumber: resolvedNieeNumber });
                await set(ref(db, `members_registry/${resolvedNieeNumber}`), { ...memberData, nieeNumber: resolvedNieeNumber, authUid: uid, status: 'Approved' });
              }
              await sendStatusEmail(memberData.email, memberData.firstName, memberData.lastName, 'Approved', memberData.membershipType, resolvedNieeNumber);
            } else if (newStatus === 'Rejected' || newStatus === 'Registered') {
              const memberSnap = await get(ref(db, `members/${uid}`));
              const memberData = memberSnap.val() || {};
              await sendStatusEmail(memberData.email, memberData.firstName, memberData.lastName, newStatus, memberData.membershipType, null, memberData.rejectionReason);
            }
          } catch (err) {
            alert('Failed to update status: ' + (err.message || err));
            // revert select to previous value by reloading
            const snap = await get(ref(db, `members/${uid}`));
            if (snap.exists()) this.value = snap.val().status || 'Pending';
          }
        });
      });

      // wire individual action buttons
      tableBody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.onclick = async (e) => {
          const action = btn.getAttribute('data-action');
          const uid = btn.getAttribute('data-uid');
          const snap = await get(ref(db, `members/${uid}`));
          const member = snap.val() || {};
          if (action === 'view') {
            const content = document.getElementById('modalContent');
            if (content) {
              content.innerHTML = renderMemberDetailsHtml(member, uid);
              modal && modal.show();
            }
            return;
          }
          if (action === 'payments') {
            const content = document.getElementById('modalContent');
            const modalLabel = document.getElementById('memberModalLabel');
            if (content) {
              const name = `${member.firstName||''} ${member.lastName||''}`.trim() || uid;
              if (modalLabel) modalLabel.textContent = `Payments — ${name}`;
              content.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span> Loading…</div>';
              modal && modal.show();
              const pSnap = await get(ref(db, `payments/${uid}`));
              const payments = pSnap.val() || {};
              const entries = Object.values(payments).sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
              if (!entries.length) {
                content.innerHTML = '<p class="text-muted">No payments found for this member.</p>';
              } else {
                const total = entries.reduce((s,p) => s + (Number(p.amount)||0), 0);
                const rows = entries.map(p => {
                  const badge = p.verified
                    ? '<span class="badge bg-success">Verified</span>'
                    : '<span class="badge bg-warning text-dark">Pending</span>';
                  const typeBadge = p.type === 'registration'
                    ? '<span class="badge bg-primary">Registration</span>'
                    : p.type === 'registration_topup'
                    ? '<span class="badge" style="background:#f59e0b;color:#fff;">Reg. Balance</span>'
                    : '<span class="badge bg-info text-dark">Annual</span>';
                  return `<tr>
                    <td>${typeBadge}</td>
                    <td>₦${Number(p.amount||0).toLocaleString()}</td>
                    <td>${formatPaymentCycle(p)}</td>
                    <td><small class="font-monospace">${p.reference||'—'}</small></td>
                    <td>${p.date ? new Date(p.date).toLocaleDateString('en-GB') : '—'}</td>
                    <td>${badge}</td>
                  </tr>`;
                }).join('');
                content.innerHTML = `
                  <div class="alert alert-success py-2 mb-3">
                    <strong>${entries.length}</strong> payment(s) &nbsp;|&nbsp; Total: <strong>₦${total.toLocaleString()}</strong>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                      <thead class="table-light"><tr><th>Type</th><th>Amount</th><th>Year</th><th>Reference</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>${rows}</tbody>
                    </table>
                  </div>`;
              }
            }
            return;
          }
          if (action === 'mark-annual-paid') {
            const name = `${member.firstName||''} ${member.lastName||''}`.trim() || uid;
            const currentCycleStart = membershipYearStart(new Date());
            const cycleStarts = Array.from({length: 5}, (_, i) => currentCycleStart - i);
            const feeAmount = membershipFees[member.membershipType] || 0;

            document.getElementById('manualPayMemberName').textContent  = name;
            document.getElementById('manualPayMemberType').textContent  = member.membershipType || '—';
            document.getElementById('manualPayAmount').value            = feeAmount;
            document.getElementById('manualPayReference').value         = '';
            document.getElementById('manualPayNote').value              = '';
            const yearSel = document.getElementById('manualPayYear');
            yearSel.innerHTML = cycleStarts.map(y => `<option value="${y}"${y===currentCycleStart?' selected':''}>${y}/${y+1}</option>`).join('');

            const modal = new bootstrap.Modal(document.getElementById('manualAnnualPayModal'));
            modal.show();

            document.getElementById('manualPaySaveBtn').onclick = async () => {
              const ref_no = document.getElementById('manualPayReference').value.trim();
              const year   = Number(yearSel.value);
              const amount = Number(document.getElementById('manualPayAmount').value) || feeAmount;
              const note   = document.getElementById('manualPayNote').value.trim();

              if (!ref_no) { alert('Please enter a transaction reference number.'); return; }

              const saveBtn = document.getElementById('manualPaySaveBtn');
              saveBtn.disabled = true;
              saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…';

              try {
                const paymentRef = push(ref(db, `payments/${uid}`));
                await set(paymentRef, {
                  reference:        ref_no,
                  amount:           amount,
                  type:             'membership',
                  year:             year,
                  verified:         true,
                  date:             new Date().toISOString(),
                  email:            member.email || '',
                  manualEntry:      true,
                  recordedBy:       userEmail,
                  note:             note || undefined
                });
                modal.hide();
                alert(`Annual dues for ${year}/${year + 1} marked as paid for ${name}.`);
              } catch (err) {
                alert('Failed to save payment: ' + (err.message || err));
              } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Save Payment';
              }
            };
            return;
          }
          if (action === 'remind') {
            const status = member.status || 'Pending';
            const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'this member';
            const confirmed = confirm(`Send a "${status}" reminder email to ${name} (${member.email})?`);
            if (!confirmed) return;
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            try {
              const result = await sendReminderEmail(
                member.email, member.firstName, member.lastName,
                status, member.membershipType, member.nieeNumber, member.rejectionReason
              );
              if (result.success) {
                btn.innerHTML = '<i class="bi bi-check me-1"></i>Sent';
                btn.classList.replace('btn-outline-warning', 'btn-success');
                setTimeout(() => {
                  btn.innerHTML = originalHtml;
                  btn.classList.replace('btn-success', 'btn-outline-warning');
                  btn.disabled = false;
                }, 3000);
              } else {
                alert('Failed to send reminder: ' + (result.error || 'Unknown error'));
                btn.innerHTML = originalHtml;
                btn.disabled = false;
              }
            } catch (err) {
              alert('Failed to send reminder: ' + err.message);
              btn.innerHTML = originalHtml;
              btn.disabled = false;
            }
            return;
          }
          if (action === 'approve' || action === 'reject') {
            try {
              const result = await showActionConfirm(action, uid, member);
              if (!result || !result.confirmed) return;
              const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
              const updatePayload = { status: newStatus, reviewedBy: userEmail, reviewedAt: new Date().toISOString() };
              if (action === 'reject' && result.reason) updatePayload.rejectionReason = result.reason;
              await update(ref(db, `members/${uid}`), updatePayload);
              const statusCell = document.getElementById(`status-${uid}`);
              if (statusCell) statusCell.innerHTML = `<span class="badge ${newStatus==='Approved' ? 'bg-success' : 'bg-danger'}">${newStatus}</span>`;
              let nieeNumber = member.nieeNumber;
              if (newStatus === 'Approved' && !nieeNumber) {
                const snap = await get(ref(db, `members/${uid}`));
                nieeNumber = snap.val()?.nieeNumber;
              }
              await sendStatusEmail(member.email, member.firstName, member.lastName, newStatus, member.membershipType, nieeNumber, result.reason);
            } catch (err) {
              console.error('Failed to update status', err);
              alert('Failed to update status: ' + (err.message||err));
            }
          }
        };
      });

      // wire checkboxes (selection)
      const selectAll = document.getElementById('selectAllCheckbox');
      if (selectAll) {
        selectAll.onchange = () => {
          const checked = selectAll.checked;
          tableBody.querySelectorAll('.member-select').forEach(cb => cb.checked = checked);
        };
      }
    }

    // Render structured HTML for member details
    function renderMemberDetailsHtml(member, uid) {
      const name = `${member.firstName||''} ${member.lastName||''}`.trim();
      const personal = `
        <h5>Personal Information</h5>
        <div class="row mb-2">
          <div class="col-md-6"><strong>Name:</strong> ${name}</div>
          <div class="col-md-6"><strong>NIEE Number:</strong> ${member.nieeNumber || 'Not yet assigned'}</div>
        </div>
        <div class="row mb-2">
          <div class="col-md-6"><strong>Email:</strong> ${member.email||'-'}</div>
          <div class="col-md-6"><strong>Phone:</strong> ${member.phone||'-'}</div>
        </div>
        <div class="row mb-2">
          <div class="col-md-6"><strong>DOB:</strong> ${member.dob||'-'}</div>
          <div class="col-md-6"><strong>Gender:</strong> ${member.gender||'-'}</div>
        </div>
        <div class="row mb-3">
          <div class="col-12"><strong>Address:</strong> ${member.address||'-'}</div>
        </div>
      `;

      const education = (member.education || []).map(e => `<li>${e.degree||''} ${e.discipline ? '<small>(' + e.discipline + ')</small>' : ''} — ${e.institution||''} <small class="text-muted">(${e.dates||''})</small></li>`).join('') || '<li class="text-muted">No education records</li>';
      const experience = (member.experience || []).map(e => `<li>${e.title||''} at ${e.employer||''}${e.employerAddress ? ', ' + e.employerAddress : ''} <small class="text-muted">(${e.date||''})</small></li>`).join('') || '<li class="text-muted">No experience records</li>';

      const meta = `
        <h6>Membership</h6>
        <div class="row mb-2">
          <div class="col-md-4"><strong>Type:</strong> ${member.membershipType||'-'}</div>
          <div class="col-md-4"><strong>Status:</strong> ${member.status||'-'}</div>
          <div class="col-md-4"><strong>Submitted:</strong> ${member.submittedAt||'-'}</div>
        </div>
      `;

      const rejection = member.rejectionReason ? `<div class="alert alert-danger">Rejection Reason: ${member.rejectionReason}</div>` : '';

      return `
        ${personal}
        ${meta}
        ${rejection}
        <h5>Education</h5>
        <ul>${education}</ul>
        <h5>Experience</h5>
        <ul>${experience}</ul>
      `;
    }

    // Show action confirm modal and optionally capture reason for rejection
    function showActionConfirm(action, uid, member) {
      return new Promise((resolve) => {
        const modalEl = document.getElementById('actionConfirmModal');
        if (!modalEl) return resolve({ confirmed: false });
        const actionTitle = document.getElementById('actionConfirmLabel');
        const actionBody = document.getElementById('actionConfirmBody');
        const reasonWrap = document.getElementById('actionConfirmReasonWrap');
        const reasonInput = document.getElementById('actionConfirmReason');
        const okBtn = document.getElementById('actionConfirmOk');
        const cancelBtn = document.getElementById('actionConfirmCancel');

        actionTitle.textContent = action === 'approve' ? 'Confirm Approve' : 'Confirm Reject';
        actionBody.textContent = action === 'approve'
          ? `Approve member ${member.firstName||''} ${member.lastName||''}? This action will set status to Approved.`
          : `Reject member ${member.firstName||''} ${member.lastName||''}? Please provide an optional reason.`;
        // show reason only for reject
        reasonWrap.classList.toggle('d-none', action !== 'reject');
        if (action !== 'reject') reasonInput.value = '';

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

        function cleanupListeners() {
          okBtn.removeEventListener('click', onOk);
          cancelBtn.removeEventListener('click', onCancel);
          modalEl.removeEventListener('hidden.bs.modal', onHidden);
        }

        function onOk() {
          const reason = action === 'reject' ? (reasonInput.value || '') : '';
          cleanupListeners();
          bsModal.hide();
          resolve({ confirmed: true, reason });
        }

        function onCancel() {
          cleanupListeners();
          bsModal.hide();
          resolve({ confirmed: false });
        }

        function onHidden() {
          // guard: if modal closed by backdrop/esc
          cleanupListeners();
          resolve({ confirmed: false });
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
      });
    }

    // Listen for members list
    const membersRef = ref(db, 'members');
    // add an error callback so permission errors are surfaced to the admin UI
    onValue(membersRef, snapshot => {
      const data = snapshot.val() || {};
      const filter = statusFilter?.value || 'all';
      // update summary counters
      const entries = Object.entries(data);
      const total = entries.length;
      let pending = 0, approved = 0, rejected = 0;
      let lastSubmitted = null;
      entries.forEach(([uid, m]) => {
        const s = (m.status || 'Pending');
        if (s === 'Pending') pending++;
        if (s === 'Approved') approved++;
        if (s === 'Rejected') rejected++;
        if (m.submittedAt) {
          const d = new Date(m.submittedAt);
          if (!isNaN(d.getTime())) {
            if (!lastSubmitted || d > lastSubmitted) lastSubmitted = d;
          }
        }
      });
      const totalEl = document.getElementById('totalCount'); if (totalEl) totalEl.textContent = String(total);
      const pendingEl = document.getElementById('pendingCount'); if (pendingEl) pendingEl.textContent = String(pending);
      const approvedEl = document.getElementById('approvedCount'); if (approvedEl) approvedEl.textContent = String(approved);
      const rejectedEl = document.getElementById('rejectedCount'); if (rejectedEl) rejectedEl.textContent = String(rejected);
      // optional last submitted display (if you want to show it later)
      const lastSubmittedEl = document.getElementById('lastSubmitted');
      if (lastSubmittedEl) lastSubmittedEl.textContent = lastSubmitted ? lastSubmitted.toLocaleString() : '-';

      tableBody.innerHTML = '';
      Object.entries(data).forEach(([uid, m]) => {
        if (filter !== 'all' && (m.status || 'Pending') !== filter) return;
        const row = renderMemberRow(uid, m);
        tableBody.appendChild(row);
      });
      attachActions();
    }, (err) => {
      // Permission denied or other read error. Show a helpful message in the table.
      console.debug('Admin members list read failed:', err && (err.message || err.code) || err);
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Unable to load members. This may be due to insufficient permissions — ensure the signed-in user is provisioned as an admin (custom claim or /admins flag).</td></tr>`;
      // disable export and bulk approve since we cannot read members
      try { exportBtn && (exportBtn.disabled = true); } catch(e){}
      try { bulkApproveBtn && (bulkApproveBtn.disabled = true); } catch(e){}
    });

    // filter change
    statusFilter?.addEventListener('change', () => {
      // trigger onValue listener will re-render with filter
    });

    // export CSV
    exportBtn?.addEventListener('click', async () => {
      const s = await get(ref(db, 'members'));
      const data = s.val() || {};
      const rows = [['uid','firstName','lastName','email','phone','membershipType','status','submittedAt']];
      Object.entries(data).forEach(([uid,m]) => rows.push([uid,m.firstName||'',m.lastName||'',m.email||'',m.phone||'',m.membershipType||'',m.status||'',m.submittedAt||'']));
      const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='members.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    // bulk approve
    const bulkApproveBtn = document.getElementById('bulkApproveBtn');
    bulkApproveBtn?.addEventListener('click', async () => {
      const selected = Array.from(tableBody.querySelectorAll('.member-select:checked')).map(cb => cb.getAttribute('data-uid'));
      if (!selected.length) return alert('No members selected');
      const fakeMember = { firstName: '', lastName: '', email: '' };
      const res = await showActionConfirm('approve', null, { firstName: '', lastName: '', email: '', count: selected.length });
      if (!res || !res.confirmed) return;
      try {
        await Promise.all(selected.map(async uid => {
          await update(ref(db, `members/${uid}`), { status: 'Approved', reviewedBy: userEmail, reviewedAt: new Date().toISOString() });
          const snap = await get(ref(db, `members/${uid}`));
          const m = snap.val() || {};
          await sendStatusEmail(m.email, m.firstName, m.lastName, 'Approved', m.membershipType, m.nieeNumber);
        }));
        selected.forEach(uid => {
          const statusCell = document.getElementById(`status-${uid}`);
          if (statusCell) statusCell.innerHTML = `<span class="badge bg-success">Approved</span>`;
          const cb = tableBody.querySelector(`.member-select[data-uid="${uid}"]`);
          if (cb) cb.checked = false;
        });
        const selectAll = document.getElementById('selectAllCheckbox'); if (selectAll) selectAll.checked = false;
        alert(`Approved ${selected.length} member(s)`);
      } catch (err) {
        console.error('Bulk approve failed', err);
        alert('Bulk approve failed: ' + (err.message || err));
      }
    });

    // ── Payments tab ────────────────────────────────────────
    let paymentsLoaded = false;

    window.loadAdminPayments = async function() {
      if (paymentsLoaded) return; // already loaded
      const tbody = document.getElementById('paymentsTableBody');
      const typeFilter = document.getElementById('paymentTypeFilter');
      const statusFilterEl = document.getElementById('paymentStatusFilter');
      const exportPaymentsBtn = document.getElementById('exportPaymentsBtn');

      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Loading…</td></tr>';

      try {
        // Load members first, then payments
        const membersSnap = await get(ref(db, 'members'));
        const membersData = membersSnap.val() || {};

        // Try full-tree read; fall back to per-uid reads if rules block it
        let allPaymentsData = {};
        try {
          const paymentsSnap = await get(ref(db, 'payments'));
          allPaymentsData = paymentsSnap.val() || {};
        } catch (permErr) {
          const results = await Promise.allSettled(
            Object.keys(membersData).map(uid =>
              get(ref(db, `payments/${uid}`)).then(s => ({ uid, val: s.val() || {} }))
            )
          );
          results.forEach(r => {
            if (r.status === 'fulfilled' && Object.keys(r.value.val).length)
              allPaymentsData[r.value.uid] = r.value.val;
          });
        }

        // Flatten all payments into one array with uid attached
        let allPayments = [];
        Object.entries(allPaymentsData).forEach(([uid, userPayments]) => {
          const member = membersData[uid] || {};
          const name = `${member.firstName||''} ${member.lastName||''}`.trim() || uid;
          const email = member.email || '—';
          const chapter = member.chapter || '—';
          const state = member.state || '—';
          Object.values(userPayments).forEach(p => {
            allPayments.push({ ...p, uid, memberName: name, memberEmail: email, memberChapter: chapter, memberState: state });
          });
        });

        // Sort newest first
        allPayments.sort((a, b) => new Date(b.date||0) - new Date(a.date||0));

        function renderPaymentsTable(payments) {
          // Stats
          const total = payments.reduce((s,p) => s + (Number(p.amount)||0), 0);
          const regCount = payments.filter(p => p.type === 'registration').length;
          const annualCount = payments.filter(p => p.type === 'membership').length;
          const countEl = document.getElementById('totalPaymentsCount');
          const amountEl = document.getElementById('totalPaymentsAmount');
          const regEl = document.getElementById('regPaymentsCount');
          const annualEl = document.getElementById('annualPaymentsCount');
          if (countEl) countEl.textContent = payments.length;
          if (amountEl) amountEl.textContent = '₦' + total.toLocaleString();
          if (regEl) regEl.textContent = regCount;
          if (annualEl) annualEl.textContent = annualCount;

          if (!payments.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No payments found.</td></tr>';
            return;
          }

          tbody.innerHTML = payments.map(p => {
            const typeBadge = p.type === 'registration'
              ? '<span class="badge bg-primary">Registration</span>'
              : p.type === 'registration_topup'
              ? '<span class="badge" style="background:#f59e0b;color:#fff;">Reg. Balance</span>'
              : '<span class="badge bg-info text-dark">Annual</span>';
            const statusBadge = p.verified
              ? '<span class="badge bg-success">Verified</span>'
              : '<span class="badge bg-warning text-dark">Pending</span>';
            const yearCol = formatPaymentCycle(p);
            return `<tr>
              <td>${p.memberName}</td>
              <td>${p.memberEmail}</td>
              <td>${p.memberChapter || '—'}</td>
              <td>${typeBadge}</td>
              <td>₦${Number(p.amount||0).toLocaleString()}</td>
              <td>${yearCol}</td>
              <td><small class="font-monospace">${p.reference||'—'}</small></td>
              <td>${p.date ? new Date(p.date).toLocaleDateString('en-GB') : '—'}</td>
              <td>${statusBadge}</td>
            </tr>`;
          }).join('');
        }

        function applyFilters() {
          const typeVal = typeFilter?.value || 'all';
          const statusVal = statusFilterEl?.value || 'all';
          let filtered = allPayments;
          if (typeVal !== 'all') filtered = filtered.filter(p => p.type === typeVal);
          if (statusVal === 'verified') filtered = filtered.filter(p => p.verified);
          if (statusVal === 'pending')  filtered = filtered.filter(p => !p.verified);
          renderPaymentsTable(filtered);
        }

        typeFilter?.addEventListener('change', applyFilters);
        statusFilterEl?.addEventListener('change', applyFilters);

        exportPaymentsBtn?.addEventListener('click', () => {
          const typeVal = typeFilter?.value || 'all';
          const statusVal = statusFilterEl?.value || 'all';
          let filtered = allPayments;
          if (typeVal !== 'all') filtered = filtered.filter(p => p.type === typeVal);
          if (statusVal === 'verified') filtered = filtered.filter(p => p.verified);
          if (statusVal === 'pending')  filtered = filtered.filter(p => !p.verified);
          const headers = ['Member Name','Email','Chapter','Type','Amount','Year','Reference','Date','Verified'];
          const rows = [headers, ...filtered.map(p => [
            p.memberName, p.memberEmail, p.memberChapter || '', p.type||'',
            p.amount||0,
            formatPaymentCycle(p),
            p.reference||'',
            p.date ? new Date(p.date).toLocaleDateString('en-GB') : '',
            p.verified ? 'Yes' : 'No'
          ])];
          const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'payments.csv';
          document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        });

        renderPaymentsTable(allPayments);
        paymentsLoaded = true;

      } catch (err) {
        console.error('Failed to load payments', err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to load payments: ${err.message||err}</td></tr>`;
      }
    };

    // ── Finance dashboard ────────────────────────────────────
    let financeLoaded = false;
    let financeAllPayments = [];

    window.loadFinanceDashboard = async function() {
      const stateBody  = document.getElementById('financeStateBody');
      const stateFoot  = document.getElementById('financeStateFoot');
      const yearSel    = document.getElementById('financeYearFilter');
      const monthSel   = document.getElementById('financeMonthFilter');
      const exportBtn  = document.getElementById('exportFinanceBtn');
      if (!stateBody) return;

      if (!financeLoaded) {
        stateBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading…</td></tr>';
        try {
          const [membersSnap, paymentsSnap] = await Promise.all([
            get(ref(db, 'members')),
            get(ref(db, 'payments'))
          ]);
          const membersData   = membersSnap.val()  || {};
          const paymentsData  = paymentsSnap.val() || {};

          financeAllPayments = [];
          Object.entries(paymentsData).forEach(([uid, userPayments]) => {
            const m = membersData[uid] || {};
            const state = normalizeStateName(m.state);
            Object.values(userPayments).forEach(p => {
              if (!p.verified) return; // only count verified payments
              financeAllPayments.push({ ...p, uid, memberState: state });
            });
          });

          // Populate year filter from actual data
          const years = [...new Set(financeAllPayments
            .map(p => p.date ? new Date(p.date).getFullYear() : null)
            .filter(Boolean)
          )].sort((a,b) => b - a);
          const existingYears = new Set([...yearSel.options].map(o => o.value));
          years.forEach(y => {
            if (!existingYears.has(String(y))) {
              const opt = document.createElement('option');
              opt.value = y; opt.textContent = y;
              yearSel.appendChild(opt);
            }
          });

          financeLoaded = true;
        } catch (err) {
          stateBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load: ${err.message||err}</td></tr>`;
          return;
        }
      }

      function renderFinance() {
        const yr  = yearSel?.value  || 'all';
        const mo  = monthSel?.value || 'all';

        let payments = financeAllPayments;
        if (yr !== 'all') payments = payments.filter(p => p.date && new Date(p.date).getFullYear() === Number(yr));
        if (mo !== 'all') payments = payments.filter(p => p.date && new Date(p.date).getMonth()    === Number(mo));

        // Summary totals
        const total    = payments.reduce((s,p) => s + (Number(p.amount)||0), 0);
        const regTotal = payments.filter(p => p.type === 'registration' || p.type === 'registration_topup')
                                 .reduce((s,p) => s + (Number(p.amount)||0), 0);
        const annTotal = payments.filter(p => p.type === 'membership')
                                 .reduce((s,p) => s + (Number(p.amount)||0), 0);

        document.getElementById('finTotalCollected').textContent = '₦' + total.toLocaleString();
        document.getElementById('finRegTotal').textContent       = '₦' + regTotal.toLocaleString();
        document.getElementById('finAnnualTotal').textContent    = '₦' + annTotal.toLocaleString();

        // Group by state
        const byState = {};
        payments.forEach(p => {
          const s = p.memberState || 'Unknown';
          if (!byState[s]) byState[s] = { reg: 0, annual: 0, members: new Set() };
          if (p.type === 'registration' || p.type === 'registration_topup') byState[s].reg    += Number(p.amount)||0;
          if (p.type === 'membership')                                       byState[s].annual += Number(p.amount)||0;
          byState[s].members.add(p.uid || p.email || '');
        });

        const stateRows = Object.entries(byState)
          .map(([state, d]) => ({ state, reg: d.reg, annual: d.annual, total: d.reg + d.annual, members: d.members.size }))
          .sort((a, b) => b.total - a.total);

        document.getElementById('finStateCount').textContent = stateRows.filter(r => r.state !== 'Unknown').length;

        if (!stateRows.length) {
          stateBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data for selected period.</td></tr>';
          stateFoot.innerHTML = '';
          return;
        }

        stateBody.innerHTML = stateRows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.state}</td>
            <td class="text-center">${r.members}</td>
            <td>₦${r.reg.toLocaleString()}</td>
            <td>₦${r.annual.toLocaleString()}</td>
            <td class="text-end fw-bold">₦${r.total.toLocaleString()}</td>
          </tr>`).join('');

        stateFoot.innerHTML = `
          <tr class="table-success fw-bold">
            <td colspan="2">TOTAL</td>
            <td class="text-center">${[...new Set(payments.map(p => p.uid||p.email||''))].length}</td>
            <td>₦${regTotal.toLocaleString()}</td>
            <td>₦${annTotal.toLocaleString()}</td>
            <td class="text-end">₦${total.toLocaleString()}</td>
          </tr>`;

        // Export
        if (exportBtn) {
          exportBtn.onclick = () => {
            const headers = ['State','Members Paid','Registration Fees','Annual Dues','Total'];
            const rows = [headers, ...stateRows.map(r => [r.state, r.members, r.reg, r.annual, r.total])];
            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `niee-finance${yr !== 'all' ? '-'+yr : ''}${mo !== 'all' ? '-m'+(Number(mo)+1) : ''}.csv`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          };
        }
      }

      yearSel?.addEventListener('change', renderFinance);
      monthSel?.addEventListener('change', renderFinance);
      renderFinance();
    };

    // ── AGM 2026 dashboard ───────────────────────────────────
    let agmLoaded = false;
    let agmAllRegs = [];

    window.loadAgmDashboard = async function() {
      const catBody   = document.getElementById('agmCategoryBody');
      const regBody   = document.getElementById('agmRegBody');
      const catFilter = document.getElementById('agmCategoryFilter');
      const exportBtn = document.getElementById('exportAgmBtn');
      if (!regBody) return;

      if (!agmLoaded) {
        regBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Loading…</td></tr>';
        try {
          const snap = await get(ref(db, 'events/agm-2026'));
          const data = snap.val() || {};
          agmAllRegs = Object.values(data);
          agmLoaded = true;
        } catch (err) {
          regBody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Failed to load: ${err.message||err}</td></tr>`;
          return;
        }
      }

      function render() {
        const catVal = catFilter?.value || 'all';
        const regs = catVal === 'all' ? agmAllRegs : agmAllRegs.filter(r => r.category === catVal);

        const total        = regs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const spouseCount   = regs.filter(r => r.hasSpouse).length;
        const virtualCount  = regs.filter(r => r.category === 'Virtual Attendee').length;

        document.getElementById('agmTotalCollected').textContent = '₦' + total.toLocaleString();
        document.getElementById('agmTotalRegs').textContent      = regs.length;
        document.getElementById('agmSpouseCount').textContent    = spouseCount;
        document.getElementById('agmVirtualCount').textContent   = virtualCount;

        // Category breakdown
        const byCat = {};
        regs.forEach(r => {
          const c = r.category || 'Unknown';
          if (!byCat[c]) byCat[c] = { count: 0, total: 0 };
          byCat[c].count += 1;
          byCat[c].total += Number(r.amount) || 0;
        });
        const catRows = Object.entries(byCat)
          .map(([category, d]) => ({ category, ...d }))
          .sort((a, b) => b.total - a.total);

        catBody.innerHTML = catRows.length
          ? catRows.map(r => `
            <tr>
              <td>${r.category}</td>
              <td>${r.count}</td>
              <td class="text-end">₦${r.total.toLocaleString()}</td>
            </tr>`).join('')
          : '<tr><td colspan="3" class="text-center text-muted">No data for selected category.</td></tr>';

        // Registrations table, newest first
        const sorted = [...regs].sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));
        regBody.innerHTML = sorted.length
          ? sorted.map(r => `
            <tr>
              <td style="font-family:monospace;font-size:.82rem;">${r.registrationCode || '—'}</td>
              <td>${r.name || '—'}</td>
              <td style="font-size:.82rem;">${r.email || '—'}</td>
              <td style="font-size:.82rem;">${r.phone || '—'}</td>
              <td style="font-family:monospace;font-size:.82rem;">${r.nieeNumber || '—'}</td>
              <td style="font-size:.82rem;">${r.branch || '—'}</td>
              <td>${r.category || '—'}</td>
              <td>${r.hasSpouse ? '<span class="badge bg-info text-dark">Yes</span>' : '—'}</td>
              <td class="text-end">₦${(Number(r.amount) || 0).toLocaleString()}</td>
              <td style="font-size:.82rem;">${r.registeredAt ? new Date(r.registeredAt).toLocaleDateString('en-GB') : '—'}</td>
            </tr>`).join('')
          : '<tr><td colspan="10" class="text-center text-muted">No registrations found.</td></tr>';

        if (exportBtn) {
          exportBtn.onclick = () => {
            const headers = ['Code','Name','Email','Phone','NIEE No','Branch','Category','Spouse','Amount','Registered At'];
            const rows = [headers, ...sorted.map(r => [
              r.registrationCode || '', r.name || '', r.email || '', r.phone || '', r.nieeNumber || '', r.branch || '',
              r.category || '', r.hasSpouse ? 'Yes' : 'No', r.amount || 0, r.registeredAt || ''
            ])];
            const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `agm-2026-registrations${catVal !== 'all' ? '-' + catVal.replace(/\s+/g,'_') : ''}.csv`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          };
        }
      }

      catFilter?.addEventListener('change', render);
      render();
    };

    // ── Conference Papers dashboard ───────────────────────────
    let papersLoaded = false;
    let papersAll = [];

    window.loadPapersDashboard = async function() {
      const body       = document.getElementById('papersBody');
      const statusFilter = document.getElementById('papersStatusFilter');
      const exportBtn  = document.getElementById('exportPapersBtn');
      if (!body) return;

      if (!papersLoaded) {
        body.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Loading…</td></tr>';
        try {
          const snap = await get(ref(db, 'events/agm-2026-papers'));
          const data = snap.val() || {};
          papersAll = Object.entries(data).map(([code, r]) => ({ code, ...r }));
          papersLoaded = true;
        } catch (err) {
          body.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to load: ${err.message||err}</td></tr>`;
          return;
        }
      }

      function viewText(title, text) {
        document.getElementById('paperViewLabel').textContent = title;
        document.getElementById('paperViewContent').textContent = text || '(none)';
        new bootstrap.Modal(document.getElementById('paperViewModal')).show();
      }

      async function setStatus(code, status) {
        try {
          await update(ref(db, `events/agm-2026-papers/${code}`), { status });
          const rec = papersAll.find(r => r.code === code);
          if (rec) rec.status = status;
        } catch (err) {
          alert('Failed to update status: ' + (err.message || err));
        }
      }

      // Event delegation avoids embedding free-text abstract/paper content
      // (which may contain quotes/apostrophes) into inline HTML attributes.
      if (!body.dataset.wired) {
        body.dataset.wired = '1';
        body.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-view]');
          if (!btn) return;
          const rec = papersAll.find(r => r.code === btn.dataset.code);
          if (!rec) return;
          const field = btn.dataset.view;
          const label = (field === 'abstract' ? 'Abstract — ' : 'Full Paper — ') + (rec.paperTitle || '');
          viewText(label, field === 'abstract' ? rec.abstract : rec.fullPaper);
        });
        body.addEventListener('change', (e) => {
          const sel = e.target.closest('[data-status-for]');
          if (!sel) return;
          setStatus(sel.dataset.statusFor, sel.value);
        });
      }

      function render() {
        const statusVal = statusFilter?.value || 'all';
        const rows = statusVal === 'all' ? papersAll : papersAll.filter(r => r.status === statusVal);

        document.getElementById('papersTotalCount').textContent      = papersAll.length;
        document.getElementById('papersAcceptedCount').textContent   = papersAll.filter(r => r.status === 'Accepted').length;
        document.getElementById('papersFullPaperCount').textContent  = papersAll.filter(r => !!r.fullPaper).length;
        document.getElementById('papersPendingCount').textContent    = papersAll.filter(r => r.status === 'Abstract Submitted' || r.status === 'Under Review').length;

        const sorted = [...rows].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

        body.innerHTML = sorted.length
          ? sorted.map(r => `
            <tr>
              <td style="font-family:monospace;font-size:.82rem;">${r.code}</td>
              <td style="max-width:220px;">${r.paperTitle || '—'}</td>
              <td style="font-size:.85rem;">${r.name || '—'}<br><span class="text-muted" style="font-size:.78rem;">${r.email || ''}</span></td>
              <td style="font-size:.82rem;">${r.subtheme || '—'}</td>
              <td>
                <select class="form-select form-select-sm" style="font-size:.78rem;" data-status-for="${r.code}">
                  ${['Abstract Submitted','Under Review','Accepted','Rejected','Full Paper Submitted'].map(s =>
                    `<option value="${s}" ${s === (r.status||'Abstract Submitted') ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
              <td><button type="button" class="btn btn-sm btn-outline-secondary" data-view="abstract" data-code="${r.code}">View</button></td>
              <td>${r.fullPaper
                  ? `<button type="button" class="btn btn-sm btn-outline-success" data-view="fullPaper" data-code="${r.code}">View</button>`
                  : '<span class="text-muted" style="font-size:.8rem;">Not submitted</span>'}</td>
              <td style="font-size:.8rem;">${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB') : '—'}</td>
            </tr>`).join('')
          : '<tr><td colspan="8" class="text-center text-muted">No submissions found.</td></tr>';

        if (exportBtn) {
          exportBtn.onclick = () => {
            const headers = ['Code','Title','Author','Email','Sub-theme','Status','Has Full Paper','Submitted At'];
            const csvRows = [headers, ...sorted.map(r => [
              r.code, r.paperTitle || '', r.name || '', r.email || '', r.subtheme || '',
              r.status || '', r.fullPaper ? 'Yes' : 'No', r.submittedAt || ''
            ])];
            const csv = csvRows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `agm-2026-papers${statusVal !== 'all' ? '-' + statusVal.replace(/\s+/g,'_') : ''}.csv`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          };
        }
      }

      statusFilter?.addEventListener('change', render);
      render();
    };

    // ── Fellow Applications dashboard ─────────────────────────
    let fellowLoaded = false;
    let fellowAll = [];

    window.loadFellowDashboard = async function() {
      const body         = document.getElementById('fellowBody');
      const statusFilter = document.getElementById('fellowStatusFilter');
      const exportBtn    = document.getElementById('exportFellowBtn');
      if (!body) return;

      if (!fellowLoaded) {
        body.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Loading…</td></tr>';
        try {
          const snap = await get(ref(db, 'fellow_applications'));
          const data = snap.val() || {};
          fellowAll = Object.entries(data).map(([id, r]) => ({ id, ...r }));
          fellowLoaded = true;
        } catch (err) {
          body.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Failed to load: ${err.message||err}</td></tr>`;
          return;
        }
      }

      function viewText(title, text) {
        document.getElementById('paperViewLabel').textContent = title;
        document.getElementById('paperViewContent').textContent = text || '(none)';
        new bootstrap.Modal(document.getElementById('paperViewModal')).show();
      }

      async function setStatus(id, status) {
        try {
          await update(ref(db, `fellow_applications/${id}`), { status });
          const rec = fellowAll.find(r => r.id === id);
          if (rec) rec.status = status;
        } catch (err) {
          alert('Failed to update status: ' + (err.message || err));
        }
      }

      if (!body.dataset.wired) {
        body.dataset.wired = '1';
        body.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-view]');
          if (!btn) return;
          const rec = fellowAll.find(r => r.id === btn.dataset.id);
          if (!rec) return;
          const field = btn.dataset.view;
          const label = (field === 'education' ? 'Education — ' : 'Experience — ') + (rec.name || '');
          viewText(label, field === 'education' ? rec.education : rec.experience);
        });
        body.addEventListener('change', (e) => {
          const sel = e.target.closest('[data-status-for]');
          if (!sel) return;
          setStatus(sel.dataset.statusFor, sel.value);
        });
      }

      function render() {
        const statusVal = statusFilter?.value || 'all';
        const rows = statusVal === 'all' ? fellowAll : fellowAll.filter(r => r.status === statusVal);
        const sorted = [...rows].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

        body.innerHTML = sorted.length
          ? sorted.map(r => `
            <tr>
              <td style="font-family:monospace;font-size:.82rem;">${r.referenceCode || '—'}</td>
              <td>${r.name || '—'}</td>
              <td style="font-size:.82rem;">${r.email || '—'}</td>
              <td style="font-size:.82rem;">${r.phone || '—'}</td>
              <td style="font-family:monospace;font-size:.82rem;">${r.isNieeMember === 'Yes' ? (r.nieeNumber || '—') : '—'}</td>
              <td style="font-family:monospace;font-size:.82rem;">${r.isNseMember === 'Yes' ? (r.nseNumber || '—') : '—'}</td>
              <td><button type="button" class="btn btn-sm btn-outline-secondary" data-view="education" data-id="${r.id}">View</button></td>
              <td><button type="button" class="btn btn-sm btn-outline-secondary" data-view="experience" data-id="${r.id}">View</button></td>
              <td>
                <select class="form-select form-select-sm" style="font-size:.78rem;" data-status-for="${r.id}">
                  ${['Submitted','Under Review','Approved','Rejected'].map(s =>
                    `<option value="${s}" ${s === (r.status||'Submitted') ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
              <td style="font-size:.8rem;">${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB') : '—'}</td>
            </tr>`).join('')
          : '<tr><td colspan="10" class="text-center text-muted">No applications found.</td></tr>';

        if (exportBtn) {
          exportBtn.onclick = () => {
            const headers = ['Ref','Name','Email','Phone','NIEE Member','NIEE No','NSE Member','NSE No','Status','Submitted At'];
            const csvRows = [headers, ...sorted.map(r => [
              r.referenceCode || '', r.name || '', r.email || '', r.phone || '',
              r.isNieeMember || '', r.nieeNumber || '', r.isNseMember || '', r.nseNumber || '',
              r.status || '', r.submittedAt || ''
            ])];
            const csv = csvRows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `fellow-applications${statusVal !== 'all' ? '-' + statusVal.replace(/\s+/g,'_') : ''}.csv`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          };
        }
      }

      statusFilter?.addEventListener('change', render);
      render();
    };
  }

  // If we're on the admin page and already allowed, initialize admin
  if (isAdminPage) {
    // initAdminPage runs after auth state ensures userEmail is set
    // If auth state already has a user, call immediately; otherwise onAuthStateChanged will call init via redirect
    onAuthStateChanged(auth, user => {
      if (user) initAdminPage();
    });
  }

  // Simple adders for form
  window.addEducation = function() {
    const container = document.getElementById('educationContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'row g-3 mb-2';
    div.innerHTML = `\n      <div class="col-md-3"><input class="form-control institutionInput" placeholder="Institution" required></div>\n      <div class="col-md-3"><input class="form-control degreeInput" placeholder="Degree" required></div>\n      <div class="col-md-3"><input class="form-control disciplineInput" placeholder="Discipline" required></div>\n      <div class="col-md-3"><input class="form-control datesInput" placeholder="Dates" required></div>\n    `;
    container.appendChild(div);
  };

  window.addExperience = function() {
    const container = document.getElementById('experienceContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'row g-3 mb-2';
    div.innerHTML = `\n      <div class="col-md-3"><input class="form-control" placeholder="Job Title" required></div>\n      <div class="col-md-3"><input class="form-control" placeholder="Duties" required></div>\n      <div class="col-md-2"><input class="form-control" placeholder="Date" required></div>\n      <div class="col-md-2"><input class="form-control" placeholder="Employer" required></div>\n      <div class="col-md-2"><input class="form-control" placeholder="Employer's Address" required></div>\n    `;
    container.appendChild(div);
  };

  // Dashboard edit modal helpers
  window.openEditModal = async function(section) {
    if (!currentUserUID) {
      alert('Please sign in first');
      return;
    }
    const titles = {
      personal: 'Edit Personal Information',
      education: 'Edit Education History',
      experience: 'Edit Work Experience',
      reference: 'Edit Reference'
    };
    const titleEl = document.getElementById('editModalTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Edit Profile';

    const snap = await get(ref(db, `members/${currentUserUID}`));
    const member = snap.val() || {};
    const modalEl = document.getElementById('editProfileModal');
    const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
    // hide all section blocks then show requested
    document.querySelectorAll('#editProfileForm [data-section]').forEach(el => el.style.display = 'none');
    const target = document.querySelector(`#editProfileForm [data-section="${section}"]`);
    if (!target) {
      alert('Edit section not found');
      return;
    }
    // populate fields depending on section
    if (section === 'personal') {
      document.getElementById('editFirstName').value = member.firstName || '';
      document.getElementById('editLastName').value = member.lastName || '';
      document.getElementById('editPhone').value = member.phone || '';
      document.getElementById('editDob').value = member.dob || '';
      document.getElementById('editAddress').value = member.address || '';
      document.getElementById('editMembershipType').value = member.membershipType || '';
      document.getElementById('editState').value = member.state || '';
      document.getElementById('editCountry').value = member.country || '';
      document.getElementById('editNationality').value = member.nationality || '';
      document.getElementById('editMembershipNumber').value = member.membershipNumber || '';
      document.getElementById('editChapter').value = member.chapter || '';
    }
    if (section === 'reference') {
      document.getElementById('editRefName').value = (member.reference && member.reference.name) || member.refName || '';
      document.getElementById('editRefEmail').value = (member.reference && member.reference.email) || member.refEmail || '';
      document.getElementById('editRefPhone').value = (member.reference && member.reference.phone) || member.refPhone || '';
      document.getElementById('editRefMemberId').value = (member.reference && member.reference.memberId) || member.refMemberId || '';
    }
    if (section === 'education') {
      const cont = document.getElementById('editEducationContainer');
      cont.innerHTML = '';
      (member.education || []).forEach(ed => {
        const row = document.createElement('div');
        row.className = 'row g-3 mb-2';
        row.innerHTML = `\n          <div class="col-md-3"><input class="form-control editInstitution" value="${(ed.institution||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-3"><input class="form-control editDegree" value="${(ed.degree||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-3"><input class="form-control editDiscipline" value="${(ed.discipline||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-3"><input class="form-control editDates" value="${(ed.dates||'').replace(/"/g,'&quot;')}"></div>\n        `;
        cont.appendChild(row);
      });
    }
    if (section === 'experience') {
      const cont = document.getElementById('editExperienceContainer');
      cont.innerHTML = '';
      (member.experience || []).forEach(ex => {
        const row = document.createElement('div');
        row.className = 'row g-3 mb-2';
        row.innerHTML = `\n          <div class="col-md-3"><input class="form-control editJobTitle" value="${(ex.title||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-3"><input class="form-control editDuties" value="${(ex.duties||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-2"><input class="form-control editExpDate" value="${(ex.date||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-2"><input class="form-control editEmployer" value="${(ex.employer||'').replace(/"/g,'&quot;')}"></div>\n          <div class="col-md-2"><input class="form-control editEmployerAddress" value="${(ex.employerAddress||'').replace(/"/g,'&quot;')}"></div>\n        `;
        cont.appendChild(row);
      });
    }

    // show the target section
    target.style.display = '';
    modal && modal.show();
  };

  // add row handlers inside edit modal
  document.getElementById('addEditEducationRow')?.addEventListener('click', () => {
    const cont = document.getElementById('editEducationContainer');
    if (!cont) return;
    const row = document.createElement('div'); row.className = 'row g-3 mb-2';
    row.innerHTML = `\n      <div class="col-md-3"><input class="form-control editInstitution" placeholder="Institution"></div>\n      <div class="col-md-3"><input class="form-control editDegree" placeholder="Degree"></div>\n      <div class="col-md-3"><input class="form-control editDiscipline" placeholder="Discipline"></div>\n      <div class="col-md-3"><input class="form-control editDates" placeholder="Dates"></div>\n    `;
    cont.appendChild(row);
  });
  document.getElementById('addEditExperienceRow')?.addEventListener('click', () => {
    const cont = document.getElementById('editExperienceContainer');
    if (!cont) return;
    const row = document.createElement('div'); row.className = 'row g-3 mb-2';
    row.innerHTML = `\n      <div class="col-md-3"><input class="form-control editJobTitle" placeholder="Job Title"></div>\n      <div class="col-md-3"><input class="form-control editDuties" placeholder="Duties"></div>\n      <div class="col-md-2"><input class="form-control editExpDate" placeholder="Date"></div>\n      <div class="col-md-2"><input class="form-control editEmployer" placeholder="Employer"></div>\n      <div class="col-md-2"><input class="form-control editEmployerAddress" placeholder="Employer's Address"></div>\n    `;
    cont.appendChild(row);
  });

  // save changes from modal
  document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    if (!currentUserUID) return alert('Not signed in');
    const form = document.getElementById('editProfileForm');
    // determine visible section
    const visible = Array.from(form.querySelectorAll('[data-section]')).find(s => s.style.display !== 'none');
    if (!visible) return alert('No section selected');
    const section = visible.getAttribute('data-section');
    try {
      if (section === 'personal') {
        const payload = {
          firstName: document.getElementById('editFirstName').value || '',
          lastName: document.getElementById('editLastName').value || '',
          phone: document.getElementById('editPhone').value || '',
          dob: document.getElementById('editDob').value || '',
          address: document.getElementById('editAddress').value || '',
          membershipType: document.getElementById('editMembershipType').value || '',
          state: document.getElementById('editState').value || '',
          country: document.getElementById('editCountry').value || '',
          nationality: document.getElementById('editNationality').value || '',
          membershipNumber: document.getElementById('editMembershipNumber').value || '',
          chapter: document.getElementById('editChapter').value || ''
        };
        await update(ref(db, `members/${currentUserUID}`), payload);
      } else if (section === 'reference') {
        const refPayload = {
          reference: {
            name: document.getElementById('editRefName').value || '',
            email: document.getElementById('editRefEmail').value || '',
            phone: document.getElementById('editRefPhone').value || '',
            memberId: document.getElementById('editRefMemberId').value || ''
          }
        };
        await update(ref(db, `members/${currentUserUID}`), refPayload);
      } else if (section === 'education') {
        const eds = Array.from(document.querySelectorAll('.editInstitution')).map((el,i) => ({ institution: el.value||'', degree: (document.querySelectorAll('.editDegree')[i]||{}).value||'', discipline: (document.querySelectorAll('.editDiscipline')[i]||{}).value||'', dates: (document.querySelectorAll('.editDates')[i]||{}).value||'' }));
        await update(ref(db, `members/${currentUserUID}`), { education: eds });
      } else if (section === 'experience') {
        const exs = Array.from(document.querySelectorAll('.editJobTitle')).map((el,i) => ({ title: el.value||'', duties: (document.querySelectorAll('.editDuties')[i]||{}).value||'', date: (document.querySelectorAll('.editExpDate')[i]||{}).value||'', employer: (document.querySelectorAll('.editEmployer')[i]||{}).value||'', employerAddress: (document.querySelectorAll('.editEmployerAddress')[i]||{}).value||'' }));
        await update(ref(db, `members/${currentUserUID}`), { experience: exs });
      }
      // close modal
      const modalEl = document.getElementById('editProfileModal');
      const bs = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
      bs && bs.hide();
      alert('Saved');
    } catch (err) {
      console.error('Save failed', err);
      alert('Save failed: ' + (err.message||err));
    }
  });

  // ── Manual Import Tab ────────────────────────────────────────
  let reservedNieeLoaded = false;

  window.loadManualImportTab = async function() {
    if (reservedNieeLoaded) return;

    const grid        = document.getElementById('reservedNieeGrid');
    const nieeSelect  = document.getElementById('mi_nieeNumber');
    const nextDisplay = document.getElementById('nextNieeDisplay');

    async function refreshCounter() {
      const snap = await get(ref(db, 'niee_counter'));
      const cur  = snap.val() || 927;
      if (nextDisplay) nextDisplay.textContent = 'NIEE' + String(cur + 1).padStart(8, '0');
    }

    async function renderReserved() {
      const snap    = await get(ref(db, 'reserved_niee'));
      const data    = snap.val() || {};
      const entries = Object.entries(data).sort(([a],[b]) => a.localeCompare(b));

      if (!entries.length) {
        if (grid) grid.innerHTML = '<div class="col-12 text-muted" style="font-size:.85rem;">No reserved numbers yet. Click "Reserve Next 30" to block a range.</div>';
        if (nieeSelect) nieeSelect.innerHTML = '<option value="" disabled selected>Reserve numbers first</option>';
        return;
      }

      if (grid) grid.innerHTML = entries.map(([num, info]) => {
        const used  = info.status === 'used';
        const bg    = used ? '#f8d7da' : '#d1f5d3';
        const txt   = used ? '#721c24' : '#155724';
        const label = used ? ('Used — ' + (info.usedFor || '')) : 'Available';
        return `<div class="col-6 col-md-3 col-lg-2">
          <div class="p-2 rounded text-center" style="background:${bg};font-size:.78rem;">
            <div style="font-weight:700;font-family:monospace;color:${txt};">${num}</div>
            <div style="color:${txt};opacity:.8;">${label}</div>
          </div>
        </div>`;
      }).join('');

      const available = entries.filter(([,i]) => i.status === 'available').map(([n]) => n);
      if (nieeSelect) nieeSelect.innerHTML = available.length
        ? '<option value="" disabled selected>Select NIEE number</option>' + available.map(n => `<option value="${n}">${n}</option>`).join('')
        : '<option value="" disabled selected>No available — reserve more</option>';
    }

    async function renderImported() {
      const tbody = document.getElementById('importedMembersBody');
      if (!tbody) return;
      const snap     = await get(ref(db, 'members'));
      const all      = snap.val() || {};
      const imported = Object.entries(all).filter(([,m]) => m.manualImport === true);
      if (!imported.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">None yet</td></tr>';
        return;
      }
      tbody.innerHTML = imported.map(([key,m]) => `
        <tr>
          <td>${[m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ')}</td>
          <td style="font-size:.82rem;">${m.email||'—'}</td>
          <td>${m.membershipType||'—'}</td>
          <td style="font-family:monospace;font-size:.82rem;">${m.nieeNumber||'—'}</td>
          <td>${m.chapter||'—'}</td>
          <td style="font-size:.82rem;">${m.reviewedAt ? new Date(m.reviewedAt).toLocaleDateString() : '—'}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-danger deleteManualBtn" data-key="${key}" data-niee="${m.nieeNumber||''}" data-name="${[m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ').replace(/"/g,'&quot;')}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`).join('');

      tbody.querySelectorAll('.deleteManualBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const memberKey  = btn.getAttribute('data-key');
          const nieeNumber = btn.getAttribute('data-niee');
          const name       = btn.getAttribute('data-name') || 'this member';
          if (!memberKey.startsWith('manual_')) {
            alert('Only manually imported members can be deleted from this list.');
            return;
          }
          if (!confirm(`Delete ${name} (${nieeNumber || 'no NIEE number'})?\n\nThis removes the member record and their payment history, and returns ${nieeNumber || 'the NIEE number'} to the available pool for reuse.`)) {
            return;
          }
          btn.disabled = true;
          try {
            await remove(ref(db, `members/${memberKey}`));
            if (nieeNumber) {
              await remove(ref(db, `members_registry/${nieeNumber}`));
              await update(ref(db, `reserved_niee/${nieeNumber}`), {
                status: 'available', reservedAt: new Date().toISOString(),
                usedFor: null, usedAt: null
              });
            }
            await remove(ref(db, `payments/${memberKey}`));
            await renderReserved();
            await renderImported();
          } catch (err) {
            alert('Failed to delete: ' + (err.message || err));
            btn.disabled = false;
          }
        });
      });
    }

    // Wire the button before any async work so it's always clickable
    // Reserve next 30
    document.getElementById('reserveBlockBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('reserveBlockBtn');
      btn.disabled = true;
      btn.textContent = 'Reserving…';
      try {
        const txResult = await runTransaction(ref(db, 'niee_counter'), cur => (cur || 927) + 30);
        const endNum   = txResult.snapshot.val();
        const startNum = endNum - 29;
        const writes   = {};
        for (let n = startNum; n <= endNum; n++) {
          const nieeNo = 'NIEE' + String(n).padStart(8, '0');
          writes[`reserved_niee/${nieeNo}`] = { status: 'available', reservedAt: new Date().toISOString() };
        }
        await update(ref(db, '/'), writes);
        await refreshCounter();
        await renderReserved();
        alert('Reserved NIEE' + String(startNum).padStart(8,'0') + ' → NIEE' + String(endNum).padStart(8,'0'));
      } catch (err) {
        alert('Failed to reserve: ' + (err.message || err));
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-bookmark-plus me-1"></i>Reserve Next 30';
      }
    });

    // Submit manual member
    document.getElementById('manualImportForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback  = document.getElementById('mi_feedback');
      const submitBtn = document.getElementById('mi_submitBtn');

      const nieeNumber     = document.getElementById('mi_nieeNumber').value.trim();
      const firstName      = document.getElementById('mi_firstName').value.trim();
      const middleName     = document.getElementById('mi_middleName').value.trim();
      const lastName       = document.getElementById('mi_lastName').value.trim();
      const email          = document.getElementById('mi_email').value.trim().toLowerCase();
      const phone          = document.getElementById('mi_phone').value.trim();
      const membershipType = document.getElementById('mi_membershipType').value;
      const chapter        = document.getElementById('mi_chapter').value;
      const approvalDate   = document.getElementById('mi_approvalDate').value;
      const markRegPaid    = document.getElementById('mi_regPaid').checked;
      const markAnnualPaid = document.getElementById('mi_annualPaid').checked;

      function showFeedback(type, msg) {
        feedback.className = 'alert alert-' + (type === 'error' ? 'danger' : 'success');
        feedback.textContent = msg;
        feedback.classList.remove('d-none');
      }

      if (!nieeNumber) { showFeedback('error', 'Please select a reserved NIEE number.'); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…';

      try {
        const approvedAt  = approvalDate ? new Date(approvalDate).toISOString() : new Date().toISOString();
        const memberKey   = 'manual_' + nieeNumber;
        const memberRecord = {
          firstName, middleName, lastName, email, phone,
          membershipType, chapter, nieeNumber,
          status: 'Approved', manualImport: true,
          submittedAt: approvedAt, reviewedAt: approvedAt,
          reviewedBy: userEmail || 'admin'
        };

        await set(ref(db, `members/${memberKey}`), memberRecord);
        await set(ref(db, `members_registry/${nieeNumber}`), { ...memberRecord, authUid: memberKey });

        const pRef = ref(db, `payments/${memberKey}`);
        if (markRegPaid) {
          const rKey = push(pRef).key;
          await set(ref(db, `payments/${memberKey}/${rKey}`), {
            type: 'registration', amount: 1000,
            year: new Date(approvedAt).getFullYear(),
            membershipType, verified: true,
            date: approvedAt, email,
            reference: 'MANUAL-REG-' + nieeNumber
          });
        }
        if (markAnnualPaid) {
          const aKey = push(pRef).key;
          const annualCycleStart = membershipYearStart(approvedAt);
          await set(ref(db, `payments/${memberKey}/${aKey}`), {
            type: 'membership', amount: membershipFees[membershipType] || 0,
            year: annualCycleStart, membershipType, verified: true,
            date: approvedAt, email,
            reference: 'MANUAL-ANN-' + nieeNumber + '-' + annualCycleStart
          });
        }

        await update(ref(db, `reserved_niee/${nieeNumber}`), {
          status: 'used', usedFor: email, usedAt: new Date().toISOString()
        });

        showFeedback('success', firstName + ' ' + lastName + ' added as ' + nieeNumber + ' successfully.');
        document.getElementById('manualImportForm').reset();
        await renderReserved();
        await renderImported();
      } catch (err) {
        showFeedback('error', 'Failed: ' + (err.message || err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-person-check me-1"></i>Add Member';
      }
    });

    // Mark as loaded only after all listeners are wired, then load data
    reservedNieeLoaded = true;
    try { await refreshCounter(); } catch (e) { console.warn('Could not load NIEE counter:', e.message); }
    try { await renderReserved(); } catch (e) { console.warn('Could not load reserved numbers:', e.message); }
    try { await renderImported(); } catch (e) { console.warn('Could not load imported members:', e.message); }
  };

});
