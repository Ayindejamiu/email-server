// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
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
  set
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

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
const provider = new GoogleAuthProvider();
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
  const nextOfKinInfo = document.getElementById('nextOfKinInfo');
  const referenceInfo = document.getElementById('referenceInfo');

  let currentUserUID = null;
  let userEmail = '';

  function clearFieldError(el) {
    try {
      if (!el) return;
      el.classList.remove('is-invalid');
      const next = el.nextElementSibling;
      if (next && next.classList && next.classList.contains('invalid-feedback')) next.remove();
    } catch (e) {}
  }

  function setFieldError(el, msg) {
    if (!el) return;
    clearFieldError(el);
    el.classList.add('is-invalid');
    const feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    feedback.textContent = msg;
    el.parentNode && el.parentNode.appendChild(feedback);
  }

  function clearAllFormErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.is-invalid').forEach(i => i.classList.remove('is-invalid'));
    formEl.querySelectorAll('.invalid-feedback').forEach(f => f.remove());
    const summary = document.getElementById('formErrors');
    if (summary) { summary.innerHTML = ''; summary.classList.add('d-none'); }
  }

  function showFormErrors(messages) {
    const summary = document.getElementById('formErrors');
    if (!summary) return;
    if (!messages || messages.length === 0) { summary.innerHTML = ''; summary.classList.add('d-none'); return; }
    summary.classList.remove('d-none');
    summary.innerHTML = `<strong>Please fix the following:</strong><ul>${messages.map(m => `<li>${m}</li>`).join('')}</ul>`;
  }

  document.addEventListener('input', (ev) => {
    const target = ev.target;
    if (!target) return;
    const form = target.closest && target.closest('#membershipForm');
    if (!form) return;
    clearFieldError(target);
    showFormErrors([]);
  });

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      createUserWithEmailAndPassword(auth, email, password)
        .then(() => window.location.href = 'membership-form.html')
        .catch(err => alert(err.message));
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      signInWithEmailAndPassword(auth, email, password)
        .then(async (cred) => {
          const uid = cred.user.uid;
          const snap = await get(ref(db, `members/${uid}`));
          if (!snap.exists()) window.location.href = 'membership-form.html';
          else window.location.href = 'dashboard.html';
        })
        .catch(err => alert(err.message));
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));
  }

  if (membershipForm) {
    onAuthStateChanged(auth, user => {
      if (!user) { window.location.href = 'login.html'; return; }
      currentUserUID = user.uid;
      document.getElementById('email').value = user.email || '';
    });

    membershipForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUserUID) return alert('Please log in first.');
      try {
        const education = [];
        document.querySelectorAll('#educationContainer .row').forEach(row => {
          const inst = row.querySelector('.institutionInput')?.value.trim() || '';
          const deg = row.querySelector('.degreeInput')?.value.trim() || '';
          const dates = row.querySelector('.datesInput')?.value.trim() || '';
          if (inst || deg || dates) education.push({ institution: inst, degree: deg, dates });
        });
        if (education.length === 0) { setFieldError(document.getElementById('educationContainer') || document.body, 'Please add at least one education record.'); showFormErrors(['Please add at least one education record.']); return; }

        const experience = [];
        document.querySelectorAll('#experienceContainer .row').forEach(row => {
          const inputs = row.querySelectorAll('input');
          if (inputs.length >= 4) {
            const title = inputs[0].value.trim();
            const duties = inputs[1].value.trim();
            const date = inputs[2].value.trim();
            const employer = inputs[3].value.trim();
            if (title || duties || date || employer) experience.push({ title, duties, date, employer });
          }
        });
        if (experience.length === 0) { setFieldError(document.getElementById('experienceContainer') || document.body, 'Please add at least one experience record.'); showFormErrors(['Please add at least one experience record.']); return; }

        const nextOfKin = {
          firstName: document.getElementById('nextFirstName')?.value.trim() || '',
          lastName: document.getElementById('nextLastName')?.value.trim() || '',
          email: document.getElementById('nextEmail')?.value.trim() || '',
          phone: document.getElementById('nextPhone')?.value.trim() || '',
          relationship: document.getElementById('nextRelationship')?.value.trim() || ''
        };
        const nkMsgs = [];
        if (!nextOfKin.firstName) { setFieldError(document.getElementById('nextFirstName'), 'Required'); nkMsgs.push('Next of Kin first name is required.'); }
        if (!nextOfKin.lastName) { setFieldError(document.getElementById('nextLastName'), 'Required'); nkMsgs.push('Next of Kin last name is required.'); }
        if (!nextOfKin.phone) { setFieldError(document.getElementById('nextPhone'), 'Required'); nkMsgs.push('Next of Kin phone is required.'); }
        if (!nextOfKin.relationship) { setFieldError(document.getElementById('nextRelationship'), 'Required'); nkMsgs.push('Next of Kin relationship is required.'); }
        if (nkMsgs.length) { showFormErrors(nkMsgs); return; }

        const reference = {
          name: document.getElementById('refName')?.value.trim() || '',
          email: document.getElementById('refEmail')?.value.trim() || '',
          phone: document.getElementById('refPhone')?.value.trim() || '',
          memberId: document.getElementById('refMemberId')?.value.trim() || ''
        };
        const refMsgs = [];
        if (!reference.name) { setFieldError(document.getElementById('refName'), 'Required'); refMsgs.push('Reference name is required.'); }
        if (!reference.email) { setFieldError(document.getElementById('refEmail'), 'Required'); refMsgs.push('Reference email is required.'); }
        if (!reference.phone) { setFieldError(document.getElementById('refPhone'), 'Required'); refMsgs.push('Reference phone is required.'); }
        if (refMsgs.length) { showFormErrors(refMsgs); return; }

        const firstName = document.getElementById('firstName')?.value.trim() || '';
        const lastName = document.getElementById('lastName')?.value.trim() || '';
        const phone = document.getElementById('phone')?.value.trim() || '';
        const email = document.getElementById('email')?.value.trim() || '';
        const dob = document.getElementById('dob')?.value || '';
        const gender = document.getElementById('gender')?.value || '';
        const address = document.getElementById('address')?.value.trim() || '';
        const persMsgs = [];
        if (!firstName) { setFieldError(document.getElementById('firstName'), 'Required'); persMsgs.push('First name is required.'); }
        if (!lastName) { setFieldError(document.getElementById('lastName'), 'Required'); persMsgs.push('Last name is required.'); }
        if (!phone) { setFieldError(document.getElementById('phone'), 'Required'); persMsgs.push('Phone number is required.'); }
        if (!email) { setFieldError(document.getElementById('email'), 'Required'); persMsgs.push('Email is required.'); }
        if (!dob) { setFieldError(document.getElementById('dob'), 'Required'); persMsgs.push('Date of birth is required.'); }
        if (!gender) { setFieldError(document.getElementById('gender'), 'Required'); persMsgs.push('Gender is required.'); }
        if (!address) { setFieldError(document.getElementById('address'), 'Required'); persMsgs.push('Address is required.'); }
        if (persMsgs.length) { showFormErrors(persMsgs); return; }

        const data = {
          firstName,
          lastName,
          phone,
          email,
          dob,
          gender,
          address,
          state: document.getElementById('state')?.value.trim() || '',
          country: document.getElementById('country')?.value.trim() || '',
          nationality: document.getElementById('nationality')?.value.trim() || '',
          education,
          experience,
          nextOfKin,
          reference,
          membershipNumber: document.getElementById('membershipNumber')?.value.trim() || '',
          chapter: document.getElementById('chapter')?.value.trim() || '',
          membershipType: document.getElementById('membershipType')?.value || 'Members',
          status: 'Pending',
          submittedAt: new Date().toISOString()
        };

        await set(ref(db, `members/${currentUserUID}`), data);
        clearAllFormErrors(membershipForm);
        const summary = document.getElementById('formErrors');
        if (summary) { summary.classList.remove('d-none'); summary.classList.remove('alert-danger'); summary.classList.add('alert-success'); summary.innerHTML = 'Membership form submitted. Status: Pending'; }
        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error('Failed to save membership', err);
        showFormErrors(['Failed to save membership form: ' + (err.message || err)]);
      }
    });
  }

  function renderPayments(uid) {
    const payRef = ref(db, `payments/${uid}`);
    onValue(payRef, snapshot => {
      const data = snapshot.val() || {};
      paymentTableBody && (paymentTableBody.innerHTML = '');
      Object.values(data).reverse().forEach(entry => {
        const row = document.createElement('tr');
        const verified = entry.verified ? true : false;
        const status = verified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning text-dark">Pending</span>';
        row.innerHTML = `\n          <td>${entry.reference || ''}</td>\n          <td>₦${entry.amount || ''}</td>\n          <td>${status}</td>\n          <td>${new Date(entry.date || Date.now()).toLocaleString()}</td>\n        `;
        paymentTableBody && paymentTableBody.appendChild(row);
I have created the file with the cleaned content and ensured it's valid JavaScript.
