// ==========================================================
// SNCS (Shri Network Courier Services) - Staff & Owner Admin JS
// Ranchi, Jharkhand 834001
// ==========================================================

let adminToken = false;

document.addEventListener('DOMContentLoaded', () => {
  // Always verify authenticated session before opening console
  checkSession();
});

async function checkSession() {
  // If the browser tab or window was closed, sessionStorage is automatically wiped clean by the browser.
  const hasActiveTabSession = sessionStorage.getItem('sncs_admin_tab_active');
  if (!hasActiveTabSession) {
    // Site or tab was closed previously - purge any backend session and enforce fresh login
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {}
    showLoginForm();
    return;
  }

  try {
    const res = await fetch('/api/admin/check-session');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        showAdminApp(data.username, data.role);
        loadAllAdminData();
        return;
      }
    }
  } catch (err) {
    console.log('Session check:', err);
  }
  showLoginForm();
}

function showLoginForm() {
  sessionStorage.removeItem('sncs_admin_tab_active');
  if (window._adminEventSource) {
    window._adminEventSource.close();
    window._adminEventSource = null;
  }
  document.getElementById('admin-app-view').classList.add('hidden');
  document.getElementById('admin-login-view').classList.remove('hidden');
  const userField = document.getElementById('admin-username');
  if (userField) {
    userField.value = '';
  }
  const passField = document.getElementById('admin-password');
  if (passField) passField.value = '';
  const errorEl = document.getElementById('admin-login-error');
  if (errorEl) errorEl.classList.add('hidden');
}

function showAdminApp(username, role) {
  document.getElementById('admin-login-view').classList.add('hidden');
  document.getElementById('admin-app-view').classList.remove('hidden');
  if (document.getElementById('logged-username')) {
    document.getElementById('logged-username').innerText = username || 'Staff';
  }
  if (document.getElementById('logged-role')) {
    document.getElementById('logged-role').innerText = (role || 'staff').toUpperCase();
  }
}

function toggleAdminPasswordVisibility() {
  const p = document.getElementById('admin-password');
  const icon = document.getElementById('toggle-pwd-btn');
  if (!p) return;
  if (p.type === 'password') {
    p.type = 'text';
    if (icon) icon.innerText = '🙈';
  } else {
    p.type = 'password';
    if (icon) icon.innerText = '👁️';
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const u = document.getElementById('admin-username').value.trim();
  const p = document.getElementById('admin-password').value.trim();
  const errorEl = document.getElementById('admin-login-error');
  const submitBtn = document.getElementById('admin-login-btn');

  if (!u || !p) {
    if (errorEl) {
      errorEl.innerText = "Please enter both username and password.";
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying Credentials...</span>';
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      // Mark current tab session as active
      sessionStorage.setItem('sncs_admin_tab_active', 'true');
      if (errorEl) errorEl.classList.add('hidden');
      showAdminApp(data.username, data.role);
      loadAllAdminData();
    } else {
      sessionStorage.removeItem('sncs_admin_tab_active');
      if (errorEl) {
        errorEl.innerText = `❌ ${data.message || 'Access Denied: Invalid credentials.'}`;
        errorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    sessionStorage.removeItem('sncs_admin_tab_active');
    if (errorEl) {
      errorEl.innerText = "⚠️ Network connection error. Please retry.";
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Secure Staff Login</span><span>→</span>';
    }
  }
}

async function handleAdminLogout() {
  sessionStorage.removeItem('sncs_admin_tab_active');
  if (window._adminEventSource) {
    window._adminEventSource.close();
    window._adminEventSource = null;
  }
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
  } catch(e){}
  showLoginForm();
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  ['bookings', 'rates', 'pincodes', 'offers'].forEach(t => {
    document.getElementById(`admin-tab-${t}`).classList.add('hidden');
  });
  document.getElementById(`admin-tab-${tab}`).classList.remove('hidden');

  if (tab === 'rates') fetchAdminRates();
  if (tab === 'pincodes') fetchAdminPincodes();
  if (tab === 'offers') fetchAdminOffers();
}

function loadAllAdminData() {
  fetchAdminDashboard();
  fetchAdminBookings();
  initAdminRealtimeStream();
}

// 1. Dashboard Stats
async function fetchAdminDashboard() {
  try {
    const res = await fetch('/api/admin/dashboard');
    if (res.status === 401) {
      showLoginForm();
      return;
    }
    const data = await res.json();

    document.getElementById('stat-total-bookings').innerText = data.total_bookings;
    document.getElementById('stat-in-transit').innerText = data.in_transit;
    document.getElementById('stat-out-for-delivery').innerText = data.out_for_delivery;
    document.getElementById('stat-delivered').innerText = data.delivered;
    document.getElementById('stat-pending-pickups').innerText = data.pending_pickups;
    document.getElementById('stat-revenue').innerText = `₹${data.total_revenue.toLocaleString('en-IN')}`;
  } catch (err) {
    console.error(err);
  }
}

// 2. Bookings List
async function fetchAdminBookings() {
  const q = document.getElementById('admin-search-query').value.trim();
  const status = document.getElementById('admin-status-filter').value;

  try {
    const res = await fetch(`/api/admin/bookings?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`);
    if (res.status === 401) {
      showLoginForm();
      return;
    }
    const list = await res.json();
    const tbody = document.getElementById('admin-bookings-tbody');

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#94a3b8;">No consignments found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(b => {
      let badgeClass = 'badge-booked';
      if (b.current_status === 'Picked Up') badgeClass = 'badge-pickedup';
      if (b.current_status === 'In Transit' || b.current_status === 'Dispatched') badgeClass = 'badge-transit';
      if (b.current_status === 'Out for Delivery') badgeClass = 'badge-out';
      if (b.current_status === 'Delivered') badgeClass = 'badge-delivered';

      return `
        <tr id="admin-row-${b.tracking_id}">
          <td><strong style="color:#60a5fa; font-size:1rem;">${b.tracking_id}</strong><br><small style="color:#64748b;">${b.created_at}</small></td>
          <td><strong>${b.sender_name}</strong><br><small style="color:#94a3b8;">📞 ${b.sender_mobile}</small></td>
          <td>${b.receiver_name}<br><small style="color:#94a3b8;">📍 ${b.receiver_city} (${b.receiver_pincode})</small></td>
          <td>${b.chargeable_weight} kg</td>
          <td><strong style="color:#34d399;">₹${b.amount}</strong><br><small style="color:#94a3b8;">${b.payment_method}</small></td>
          <td><span class="status-badge-pill ${badgeClass}">${b.current_status}</span></td>
          <td><small style="color:#cbd5e1;">${b.current_hub}</small></td>
          <td>
            <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="openStatusModal('${b.tracking_id}', '${b.current_status}', '${b.current_hub}')">
              📍 Update Hub/Status
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// 3. Status Update Modal
function openStatusModal(tid, currentStatus, currentHub) {
  document.getElementById('modal-update-tid').innerText = tid;
  document.getElementById('modal-hidden-tid').value = tid;
  document.getElementById('modal-new-status').value = currentStatus;
  document.getElementById('modal-new-hub').value = currentHub || 'Ranchi Overbridge Hub';
  document.getElementById('modal-new-remarks').value = '';
  document.getElementById('status-update-modal').classList.remove('hidden');
}

function closeStatusModal() {
  document.getElementById('status-update-modal').classList.add('hidden');
}

async function handleStatusUpdateSubmit(e) {
  e.preventDefault();
  const tid = document.getElementById('modal-hidden-tid').value;
  const status = document.getElementById('modal-new-status').value;
  const hub = document.getElementById('modal-new-hub').value.trim();
  const remarks = document.getElementById('modal-new-remarks').value.trim();

  try {
    const res = await fetch(`/api/admin/bookings/${tid}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, hub_name: hub, remarks })
    });
    const data = await res.json();
    if (data.success) {
      closeStatusModal();
      loadAllAdminData();
      alert(`Consignment ${tid} updated to '${status}' successfully!`);
    } else {
      alert(data.message || 'Update failed');
    }
  } catch (err) {
    alert('Connection error');
  }
}

// 4. Rates Management
async function fetchAdminRates() {
  try {
    const res = await fetch('/api/rates');
    const rates = await res.json();
    const tbody = document.getElementById('admin-rates-tbody');

    tbody.innerHTML = rates.map(r => `
      <tr>
        <td><strong>${r.zone}</strong></td>
        <td>${r.zone_name}</td>
        <td>
          <input type="number" id="rate-first-${r.id}" value="${r.first_kg_price}" step="5" style="width:90px; background:#0f172a; color:white; padding:0.4rem; border:1px solid rgba(255,255,255,0.15); border-radius:6px;">
        </td>
        <td>
          <input type="number" id="rate-extra-${r.id}" value="${r.extra_kg_price}" step="5" style="width:90px; background:#0f172a; color:white; padding:0.4rem; border:1px solid rgba(255,255,255,0.15); border-radius:6px;">
        </td>
        <td>
          <input type="text" id="rate-tat-${r.id}" value="${r.delivery_days}" style="width:140px; background:#0f172a; color:white; padding:0.4rem; border:1px solid rgba(255,255,255,0.15); border-radius:6px;">
        </td>
        <td>
          <button class="btn btn-primary" style="padding:0.35rem 0.8rem; font-size:0.8rem;" onclick="saveRate(${r.id})">Save</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function saveRate(rateId) {
  const firstKg = document.getElementById(`rate-first-${rateId}`).value;
  const extraKg = document.getElementById(`rate-extra-${rateId}`).value;
  const days = document.getElementById(`rate-tat-${rateId}`).value;

  try {
    const res = await fetch(`/api/admin/rates/${rateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_kg_price: firstKg,
        extra_kg_price: extraKg,
        delivery_days: days
      })
    });
    const data = await res.json();
    alert(data.message || 'Rate updated!');
  } catch (err) {
    alert('Error saving rate.');
  }
}

// 5. Pincodes Management
async function fetchAdminPincodes() {
  try {
    const res = await fetch('/api/admin/pincodes');
    if (res.status === 401) {
      showLoginForm();
      return;
    }
    const pins = await res.json();
    const tbody = document.getElementById('admin-pincodes-tbody');

    tbody.innerHTML = pins.map(p => `
      <tr>
        <td><strong>${p.pincode}</strong></td>
        <td>${p.city} (${p.state})</td>
        <td>${p.zone}</td>
        <td>${p.tat_days}</td>
        <td><span class="badge ${p.serviceable ? 'badge-success' : 'badge-accent'}">${p.serviceable ? 'Active' : 'Off'}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function handleSavePincode(e) {
  e.preventDefault();
  const payload = {
    pincode: document.getElementById('new-pin').value.trim(),
    city: document.getElementById('new-pin-city').value.trim(),
    state: document.getElementById('new-pin-state').value.trim(),
    zone: document.getElementById('new-pin-zone').value,
    tat_days: document.getElementById('new-pin-tat').value.trim(),
    serviceable: true
  };

  try {
    const res = await fetch('/api/admin/pincodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert(data.message || 'Pincode saved!');
    document.getElementById('admin-pincode-form').reset();
    fetchAdminPincodes();
  } catch (err) {
    alert('Failed to save pincode');
  }
}

// 6. Offers Management
async function fetchAdminOffers() {
  try {
    const res = await fetch('/api/admin/offers');
    if (res.status === 401) {
      showLoginForm();
      return;
    }
    const offer = await res.json();

    document.getElementById('admin-offer-text').value = offer.text || '';
    document.getElementById('admin-offer-discount').value = offer.discount_amount || 50;
    document.getElementById('admin-offer-active').checked = Boolean(offer.is_active);
  } catch (err) {
    console.error(err);
  }
}

async function handleSaveOffer(e) {
  e.preventDefault();
  const payload = {
    text: document.getElementById('admin-offer-text').value.trim(),
    discount_amount: parseFloat(document.getElementById('admin-offer-discount').value),
    is_active: document.getElementById('admin-offer-active').checked
  };

  try {
    const res = await fetch('/api/admin/offers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert(data.message || 'Offer settings updated!');
  } catch (err) {
    alert('Failed to update offer');
  }
}

// ==========================================================
// REAL-TIME ADMIN STREAMING & SIMULATOR LOGIC
// ==========================================================

function initAdminRealtimeStream() {
  if (window._adminEventSource) {
    window._adminEventSource.close();
    window._adminEventSource = null;
  }

  const es = new EventSource('/api/stream/admin');
  window._adminEventSource = es;

  es.addEventListener('connected', () => {
    const badge = document.getElementById('admin-live-badge');
    const text = document.getElementById('admin-live-text');
    if (badge) badge.classList.add('connected');
    if (text) text.innerText = 'Real-Time Feed Synchronized';
  });

  es.addEventListener('new_booking', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleAdminNewBooking(data.booking);
    } catch (e) {
      console.error('Error handling new_booking:', e);
    }
  });

  es.addEventListener('status_update', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleAdminStatusUpdate(data);
    } catch (e) {
      console.error('Error handling status_update:', e);
    }
  });

  es.onerror = () => {
    const badge = document.getElementById('admin-live-badge');
    const text = document.getElementById('admin-live-text');
    if (badge) badge.classList.remove('connected');
    if (text) text.innerText = 'Feed Reconnecting...';
  };
}

function handleAdminNewBooking(b) {
  playAdminChime();

  showAdminToast(
    '📦 Nayi Booking Aayi!',
    `Tracking: <strong>${b.tracking_id}</strong> from <strong>${b.sender_name}</strong> (₹${b.amount}). Scheduled for pickup in Ranchi.`
  );

  // Increment counters
  const totalEl = document.getElementById('stat-total-bookings');
  if (totalEl) totalEl.innerText = (parseInt(totalEl.innerText) || 0) + 1;

  const pendingEl = document.getElementById('stat-pending-pickups');
  if (pendingEl) pendingEl.innerText = (parseInt(pendingEl.innerText) || 0) + 1;

  const revEl = document.getElementById('stat-revenue');
  if (revEl) {
    const currentRev = parseFloat(revEl.innerText.replace(/[₹,]/g, '') || 0);
    revEl.innerText = `₹${Math.round(currentRev + parseFloat(b.amount || 0)).toLocaleString('en-IN')}`;
  }

  // Prepend row to table with glow
  const tbody = document.getElementById('admin-bookings-tbody');
  if (tbody) {
    const emptyRow = tbody.querySelector('td[colspan="8"]');
    if (emptyRow) tbody.innerHTML = '';

    const tr = document.createElement('tr');
    tr.id = `admin-row-${b.tracking_id}`;
    tr.className = 'row-new-highlight';
    tr.innerHTML = `
      <td><strong style="color:#60a5fa; font-size:1rem;">${b.tracking_id}</strong><br><small style="color:#64748b;">${b.created_at}</small></td>
      <td><strong>${b.sender_name}</strong><br><small style="color:#94a3b8;">📞 ${b.sender_mobile}</small></td>
      <td>${b.receiver_name}<br><small style="color:#94a3b8;">📍 ${b.receiver_city} (${b.receiver_pincode})</small></td>
      <td>${b.chargeable_weight} kg</td>
      <td><strong style="color:#34d399;">₹${b.amount}</strong><br><small style="color:#94a3b8;">${b.payment_method}</small></td>
      <td><span class="status-badge-pill badge-booked">${b.current_status}</span></td>
      <td><small style="color:#cbd5e1;">${b.current_hub}</small></td>
      <td>
        <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="openStatusModal('${b.tracking_id}', '${b.current_status}', '${b.current_hub}')">
          📍 Update Hub/Status
        </button>
      </td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
  }
}

function handleAdminStatusUpdate(data) {
  const row = document.getElementById(`admin-row-${data.tracking_id}`);
  if (row) {
    let badgeClass = 'badge-booked';
    if (data.current_status === 'Picked Up') badgeClass = 'badge-pickedup';
    if (data.current_status === 'In Transit' || data.current_status === 'Dispatched') badgeClass = 'badge-transit';
    if (data.current_status === 'Out for Delivery') badgeClass = 'badge-out';
    if (data.current_status === 'Delivered') badgeClass = 'badge-delivered';

    const statusPill = row.querySelector('.status-badge-pill');
    if (statusPill) {
      statusPill.className = `status-badge-pill ${badgeClass}`;
      statusPill.innerText = data.current_status;
    }

    const hubCell = row.children[6];
    if (hubCell) {
      hubCell.innerHTML = `<small style="color:#cbd5e1;">${data.current_hub}</small>`;
    }

    row.classList.remove('row-new-highlight');
    void row.offsetWidth;
    row.classList.add('row-new-highlight');
  }

  fetchAdminDashboard();
}

function playAdminChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {}
}

function showAdminToast(title, message) {
  let container = document.getElementById('sncs-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sncs-toast-container';
    container.className = 'sncs-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'sncs-toast toast-success';
  toast.innerHTML = `
    <span style="font-size: 1.4rem;">🔔</span>
    <div style="flex: 1;">
      <div style="font-weight: 700; font-size: 0.88rem; color: #f8fafc; margin-bottom: 0.15rem;">${title}</div>
      <div style="color: #cbd5e1; font-size: 0.8rem; line-height: 1.4;">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

// Simulator Modal Handlers
function openSimulationModal() {
  document.getElementById('simulation-modal').classList.remove('hidden');
}

function closeSimulationModal() {
  document.getElementById('simulation-modal').classList.add('hidden');
}

async function handleStartSimulation(e) {
  e.preventDefault();
  const tid = document.getElementById('sim-tracking-id').value;
  const speed = document.getElementById('sim-speed').value;
  const btn = document.getElementById('sim-submit-btn');
  const box = document.getElementById('sim-progress-box');
  const bar = document.getElementById('sim-progress-bar');
  const timer = document.getElementById('sim-status-timer');

  btn.disabled = true;
  btn.innerText = "Initiating Simulation...";

  try {
    const res = await fetch('/api/admin/simulate-transit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_id: tid, speed_seconds: parseFloat(speed) })
    });
    const data = await res.json();

    if (!data.success) {
      alert(data.message || 'Could not start simulation.');
      btn.disabled = false;
      btn.innerText = "▶ Start Live Simulation";
      return;
    }

    box.classList.remove('hidden');
    let pct = 15;
    bar.style.width = `${pct}%`;
    timer.innerText = `Streaming every ${speed}s`;

    showAdminToast('⚡ Simulation Live', `Simulating consignment <strong>${tid}</strong>. Watch customer tracking & admin table update live!`);

    const intervalId = setInterval(() => {
      pct += 16;
      if (pct > 100) pct = 100;
      bar.style.width = `${pct}%`;
      if (pct >= 100) {
        clearInterval(intervalId);
        timer.innerText = "Delivered & Completed!";
        btn.disabled = false;
        btn.innerText = "▶ Start Live Simulation";
      }
    }, parseFloat(speed) * 1000);

  } catch (err) {
    alert('Failed to connect to simulation runner');
    btn.disabled = false;
    btn.innerText = "▶ Start Live Simulation";
  }
}

// ==========================================================
// CHANGE PASSWORD / PIN MODAL HANDLERS
// ==========================================================

function openChangePasswordModal() {
  const modal = document.getElementById('change-password-modal');
  if (modal) modal.classList.remove('hidden');
  const err = document.getElementById('pwd-change-error');
  if (err) err.classList.add('hidden');
  const succ = document.getElementById('pwd-change-success');
  if (succ) succ.classList.add('hidden');
  document.getElementById('pwd-current').value = '';
  document.getElementById('pwd-new').value = '';
  document.getElementById('pwd-confirm').value = '';
}

function closeChangePasswordModal() {
  const modal = document.getElementById('change-password-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const current = document.getElementById('pwd-current').value.trim();
  const newPwd = document.getElementById('pwd-new').value.trim();
  const confirmPwd = document.getElementById('pwd-confirm').value.trim();
  const errEl = document.getElementById('pwd-change-error');
  const succEl = document.getElementById('pwd-change-success');
  const submitBtn = document.getElementById('pwd-submit-btn');

  errEl.classList.add('hidden');
  succEl.classList.add('hidden');

  if (newPwd !== confirmPwd) {
    errEl.innerText = "New passwords do not match. Please verify.";
    errEl.classList.remove('hidden');
    return;
  }

  if (newPwd.length < 6) {
    errEl.innerText = "New password must be at least 6 characters long.";
    errEl.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = "Updating Password...";

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: current,
        new_password: newPwd
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      succEl.innerText = data.message || "Password updated successfully!";
      succEl.classList.remove('hidden');
      document.getElementById('pwd-current').value = '';
      document.getElementById('pwd-new').value = '';
      document.getElementById('pwd-confirm').value = '';
      setTimeout(() => {
        closeChangePasswordModal();
      }, 2000);
    } else {
      errEl.innerText = data.message || "Failed to change password.";
      errEl.classList.remove('hidden');
    }
  } catch (err) {
    errEl.innerText = "Connection error. Please try again.";
    errEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Update Password";
  }
}


