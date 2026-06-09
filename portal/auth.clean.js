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

// Cleaned auth script (auth.clean.js)
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

  const membershipFees = {
    "Student Members": 500,
    "Graduate Members": 1000,
    "Associate Members": 2000,
    "Members": 5000,
    "Fellows": 10000,
    "Corporate Body Member": 20000
  };

  let currentUserUID = null;
  let userEmail = '';

  // Register
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

  // Login
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

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));
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
      if (!currentUserUID) return alert('Please log in first.');
      try {
        const education = [];
        document.querySelectorAll('#educationContainer .row').forEach(row => {
          const inst = row.querySelector('.institutionInput')?.value || '';
          const deg = row.querySelector('.degreeInput')?.value || '';
          const dates = row.querySelector('.datesInput')?.value || '';
          if (inst || deg || dates) education.push({ institution: inst, degree: deg, dates });
        });

        const experience = [];
        document.querySelectorAll('#experienceContainer .row').forEach(row => {
          const inputs = row.querySelectorAll('input');
          if (inputs.length >= 4) experience.push({ title: inputs[0].value, duties: inputs[1].value, date: inputs[2].value, employer: inputs[3].value });
        });

        const data = {
          firstName: document.getElementById('firstName')?.value || '',
          lastName: document.getElementById('lastName')?.value || '',
          phone: document.getElementById('phone')?.value || '',
          email: document.getElementById('email')?.value || '',
          dob: document.getElementById('dob')?.value || '',
          gender: document.getElementById('gender')?.value || '',
          address: document.getElementById('address')?.value || '',
          education,
          experience,
          membershipType: document.getElementById('membershipType')?.value || 'Members',
          status: 'Pending',
          submittedAt: new Date().toISOString()
        };

        await set(ref(db, `members/${currentUserUID}`), data);
        alert('Membership form submitted. Status: Pending');
        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error(err);
        alert('Failed to save membership: ' + err.message);
      }
    });
  }

  // Payment helpers
  window.showRegistrationFee = function(uid) {
    if (!paymentYears) return;
    paymentYears.innerHTML = '';
    const col = document.createElement('div');
    col.className = 'col-md-6 offset-md-3';
    const amount = 10000;
    col.innerHTML = `\n      <div class="border p-3 rounded text-center">\n        <h5 class="mb-3">Registration Fee</h5>\n        <p class="mb-2">₦${amount}</p>\n        <button class="btn btn-success" id="payRegistrationBtn">Pay Registration</button>\n      </div>\n    `;
    paymentYears.appendChild(col);
    document.getElementById('payRegistrationBtn')?.addEventListener('click', () => payRegistration(uid, amount));
  };

  window.payRegistration = function(uid, amount) {
    if (typeof PaystackPop === 'undefined') return alert('Paystack not loaded');
    const emailForPayment = userEmail || (auth.currentUser && auth.currentUser.email) || '';
    if (!emailForPayment) return alert('No email available for payment');

    const handler = PaystackPop.setup({
      key: 'pk_test_11e7c062f2cf09ad03cbcea3a6d9d4492c2e3bf9',
      email: emailForPayment,
      amount: amount * 100,
      currency: 'NGN',
      metadata: { uid },
      callback: function(response) {
        const paymentRef = push(ref(db, `payments/${uid}`));
        set(paymentRef, { reference: response.reference, amount, type: 'registration', verified: true, date: new Date().toISOString(), email: emailForPayment })
          .then(() => update(ref(db, `members/${uid}`), { status: 'Submitted', submittedAt: new Date().toISOString() }))
          .then(() => { alert('Registration payment saved'); window.location.reload(); })
          .catch(err => { console.error(err); alert('Saved payment failed: ' + err.message); });
      },
      onClose: function() { alert('Payment closed'); }
    });
    handler.openIframe();
  };

  window.payNow = function(uid, amount, year, membershipType) {
    if (typeof PaystackPop === 'undefined') return alert('Paystack not loaded');
    const emailForPayment = userEmail || (auth.currentUser && auth.currentUser.email) || '';
    if (!emailForPayment) return alert('No email available for payment');

    const handler = PaystackPop.setup({
      key: 'pk_test_11e7c062f2cf09ad03cbcea3a6d9d4492c2e3bf9',
      email: emailForPayment,
      amount: amount * 100,
      currency: 'NGN',
      metadata: { uid, membershipType, year },
      callback: function(response) {
        const paymentRef = push(ref(db, `payments/${uid}`));
        set(paymentRef, { reference: response.reference, amount, year, membershipType, verified: true, date: new Date().toISOString(), email: emailForPayment })
          .then(() => alert('Payment saved'))
          .catch(err => { console.error(err); alert('Saving payment failed'); });
      },
      onClose: function() { alert('Payment closed'); }
    });
    handler.openIframe();
  };

  // Payments view
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
      });
      if (paymentHistory) paymentHistory.classList.toggle('d-none', Object.keys(data).length === 0);
    });
  }

  // Dashboard population
  onAuthStateChanged(auth, user => {
    if (!user) return;
    currentUserUID = user.uid;
    userEmail = user.email || '';
    const userRef = ref(db, `members/${currentUserUID}`);
    onValue(userRef, snap => {
      const data = snap.val() || {};
      if (memberName) memberName.textContent = `${data.firstName || ''} ${data.lastName || ''}`;
      if (memberEmail) memberEmail.textContent = data.email || user.email || '';
      if (memberStatus) memberStatus.textContent = data.status || 'Pending';
      if (educationList) educationList.innerHTML = (data.education || []).map(e => `<li>${e.degree || ''} at ${e.institution || ''} (${e.dates || ''})</li>`).join('');
      if (experienceList) experienceList.innerHTML = (data.experience || []).map(e => `<li>${e.title || ''} at ${e.employer || ''} (${e.date || ''})</li>`).join('');
      renderPayments(currentUserUID);
      // show registration fee if no registration payment
      const paymentsSnap = get(ref(db, `payments/${currentUserUID}`)).then(s => {
        const payments = s.val() || {};
        const regPaid = Object.values(payments).some(p => p.type === 'registration');
        if (!regPaid) showRegistrationFee(currentUserUID);
      });
    });
  });

  // Simple adders for form
  window.addEducation = function() {
    const container = document.getElementById('educationContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'row g-3 mb-2';
    div.innerHTML = `\n      <div class="col-md-4"><input class="form-control institutionInput" placeholder="Institution"></div>\n      <div class="col-md-4"><input class="form-control degreeInput" placeholder="Degree"></div>\n      <div class="col-md-4"><input class="form-control datesInput" placeholder="Dates"></div>\n    `;
    container.appendChild(div);
  };

  window.addExperience = function() {
    const container = document.getElementById('experienceContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'row g-3 mb-2';
    div.innerHTML = `\n      <div class="col-md-3"><input class="form-control" placeholder="Job Title"></div>\n      <div class="col-md-3"><input class="form-control" placeholder="Duties"></div>\n      <div class="col-md-3"><input class="form-control" placeholder="Date"></div>\n      <div class="col-md-3"><input class="form-control" placeholder="Employer"></div>\n    `;
    container.appendChild(div);
  };

});
