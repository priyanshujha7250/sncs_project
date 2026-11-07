// ==========================================================
// SNCS (Shri Network Courier Services) - Client Application
// Ranchi, Jharkhand 834001
// ==========================================================

let currentLanguage = 'en';
let globalRates = [];
let bookingDiscount = 0.0;
let lastCreatedBooking = null;
let activeOfferData = {
  text: "First booking par ₹50 OFF · Code: FIRST50",
  text_hi: "पहली बुकिंग पर ₹50 की छूट · कोड: FIRST50",
  code: "FIRST50",
  discount_amount: 50.0,
  is_active: true
};
let appliedPromoCode = "";

const i18nDictionary = {
  en: {
    nav_track: "Track Parcel",
    nav_book: "Book & Pay",
    nav_price: "Rate Calculator",
    nav_pin: "Pin Code Check",
    nav_contact: "Contact Us",
    hero_badge: "Ranchi's Most Reliable Express Delivery",
    hero_title: "Ranchi se Poore Bharat Tak, <span class='gradient-text'>Tez aur Bharosemand</span> Delivery",
    hero_desc: "Shri Network Courier Services (SNCS) provides doorstep pickup across Ranchi, express surface & air network, live milestone tracking, and lowest transparent rates starting at ₹40.",
    dock_track_title: "Live Tracking",
    dock_track_desc: "Real-time parcel timeline & stops",
    dock_book_title: "Book & Pay",
    dock_book_desc: "Doorstep pickup & ₹50 discount",
    dock_price_title: "Price Calculator",
    dock_price_desc: "Volumetric & actual weight rates",
    dock_pin_title: "Pin Code Check",
    dock_pin_desc: "Verify coverage & delivery days",
    offer_prefix: "First booking par ₹50 OFF · Code:",
    offer_claim: "Claim Discount →",
    hero_stat_claim: "Claim →"
  },
  hi: {
    nav_track: "पार्सल ट्रैक करें",
    nav_book: "बुक एवं भुगतान",
    nav_price: "रेट कैलकुलेटर",
    nav_pin: "पिन कोड जांचें",
    nav_contact: "संपर्क करें",
    hero_badge: "राँची की सबसे भरोसेमंद एक्सप्रेस डिलीवरी",
    hero_title: "राँची से पूरे भारत तक, <span class='gradient-text'>तेज़ और सुरक्षित</span> कूरियर सेवा",
    hero_desc: "श्री नेटवर्क कूरियर सर्विसेज (SNCS) - गांधी मार्केट, बसेरा होटल ओवरब्रिज के पास, राँची। घर से पिकअप, लाइव ट्रैकिंग और मात्र ₹40 से शुरू होने वाले किफायती रेट्स।",
    dock_track_title: "लाइव ट्रैकिंग",
    dock_track_desc: "पार्सल की ताज़ा स्थिति और स्टॉपेज",
    dock_book_title: "बुक और भुगतान",
    dock_book_desc: "घर से पिकअप व ₹50 पहली छूट",
    dock_price_title: "रेट कैलकुलेटर",
    dock_price_desc: "वजन और साइज के अनुसार खर्च",
    dock_pin_title: "पिन कोड चेक",
    dock_pin_desc: "डिलीवरी समय और सर्विसिबिलिटी",
    offer_prefix: "पहली बुकिंग पर ₹50 की छूट · कोड:",
    offer_claim: "छूट पाएँ →",
    hero_stat_claim: "छूट लें →"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchFestiveOffer();
  fetchRates();
  checkUrlPromoParams();
  recalculateBookingQuote();
  runLiveCalculator();
  executeTracking(false);
  setupBookingStepTracker();

  // Initialize booking PIN status and button state
  const initialPin = document.getElementById('receiver_pincode')?.value;
  if (initialPin && initialPin.length === 6) {
    handleBookingPinChange(initialPin);
  } else {
    updateBookingSubmitButtonState();
  }
});

// Theme Toggle (Light / Dark)
function initTheme() {
  const savedTheme = localStorage.getItem('sncs_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerText = '🌙 Dark';
  } else {
    document.body.classList.remove('dark-mode');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerText = '☀️ Light';
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('sncs_theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerText = isDark ? '🌙 Dark' : '☀️ Light';
  }
}

// Language Toggle
function toggleLanguage() {
  currentLanguage = (currentLanguage === 'en') ? 'hi' : 'en';
  document.getElementById('lang-toggle-btn').innerText = (currentLanguage === 'en') ? '🌐 हिंदी / ENG' : '🌐 ENG / हिंदी';

  const dict = i18nDictionary[currentLanguage];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  updateOfferDisplayForLanguage();
}

// Smooth Scroll Helper with Header Offset
function smoothScrollToElement(el) {
  if (!el) return;
  const header = document.querySelector('.main-header');
  const headerHeight = header ? header.offsetHeight : 80;
  const elementPosition = el.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;
  window.scrollTo({
    top: Math.max(0, offsetPosition),
    behavior: 'smooth'
  });
}

// Handler specifically for "Book Now" buttons to switch tab & smooth-scroll
function handleBookNowClick(e) {
  if (e && e.preventDefault) e.preventDefault();
  switchTab('book', true);
  const bookSection = document.getElementById('tab-book');
  if (bookSection) {
    smoothScrollToElement(bookSection);
  }
}

// Tab Switching
function switchTab(tabId, shouldScroll = true) {
  // Disconnect tracking live stream if leaving tracking tab
  if (tabId !== 'track' && window._trackingEventSource) {
    window._trackingEventSource.close();
    window._trackingEventSource = null;
  }

  // Update desktop nav
  document.querySelectorAll('.desktop-nav .nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update mobile bottom dock
  document.querySelectorAll('.mobile-bottom-dock .mobile-dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update action dock
  document.querySelectorAll('.dock-card').forEach(card => {
    card.classList.toggle('active', card.id === `dock-btn-${tabId}`);
  });

  // Update tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`tab-${tabId}`);
  if (activePanel) {
    activePanel.classList.add('active');
    
    // Smooth scroll to target workspace tab panel if requested
    if (shouldScroll) {
      smoothScrollToElement(activePanel);
    }
  }
}

// ==========================================================
// FESTIVE OFFER & PROMO CODE SYSTEM
// ==========================================================

// Fetch Active Festive Offer from Server
async function fetchFestiveOffer() {
  const banner = document.getElementById('festive-banner');
  if (!banner) return;

  // Check if dismissed in this browser
  if (localStorage.getItem('sncs_hide_offer_banner') === 'true') {
    banner.style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/api/offers');
    const data = await res.json();
    if (data && data.is_active) {
      activeOfferData = data;
      const code = (data.code || 'FIRST50').trim().toUpperCase();

      const codeEl = document.getElementById('banner-promo-code');
      if (codeEl) codeEl.innerText = code;

      const chipEl = document.getElementById('banner-promo-chip');
      if (chipEl) chipEl.setAttribute('aria-label', `Copy promo code ${code}`);

      // Update hero stat offer item dynamically
      const heroStat = document.getElementById('hero-stat-offer');
      if (heroStat) {
        heroStat.setAttribute('onclick', `navigateToBookWithPromo('${code}')`);
        heroStat.setAttribute('onkeydown', `if(event.key==='Enter'||event.key===' '){event.preventDefault();navigateToBookWithPromo('${code}');}`);
        heroStat.title = `Click to claim ₹${Math.round(data.discount_amount || 50)} welcome discount with code ${code}`;
        heroStat.setAttribute('aria-label', `Claim ₹${Math.round(data.discount_amount || 50)} OFF first booking welcome discount with code ${code}`);
        const statNum = heroStat.querySelector('.stat-number');
        if (statNum) statNum.innerText = `₹${Math.round(data.discount_amount || 50)} OFF`;
      }

      updateOfferDisplayForLanguage();
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load offer banner:', err);
  }
}

// Update Offer Prefix According to Selected Language
function updateOfferDisplayForLanguage() {
  const prefixEl = document.getElementById('festive-prefix');
  if (!prefixEl) return;

  const discount = (activeOfferData && activeOfferData.discount_amount) ? Math.round(activeOfferData.discount_amount) : 50;

  if (currentLanguage === 'hi') {
    if (activeOfferData && activeOfferData.text_hi) {
      const parts = activeOfferData.text_hi.split(/·\s*कोड:|·\s*Code:/i);
      prefixEl.innerText = (parts[0] ? parts[0].trim() + ' · कोड:' : `पहली बुकिंग पर ₹${discount} की छूट · कोड:`);
    } else {
      prefixEl.innerText = `पहली बुकिंग पर ₹${discount} की छूट · कोड:`;
    }
  } else {
    if (activeOfferData && activeOfferData.text) {
      const parts = activeOfferData.text.split(/·\s*Code:|·\s*कोड:/i);
      prefixEl.innerText = (parts[0] ? parts[0].trim() + ' · Code:' : `First booking par ₹${discount} OFF · Code:`);
    } else {
      prefixEl.innerText = `First booking par ₹${discount} OFF · Code:`;
    }
  }
}

// Dismiss and Remember in LocalStorage
function closeOfferBanner() {
  const banner = document.getElementById('festive-banner');
  if (banner) {
    banner.style.display = 'none';
  }
  localStorage.setItem('sncs_hide_offer_banner', 'true');
}

// Copy Promo Code from Banner Chip with Tooltip Feedback
function copyBannerPromoCode(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const code = (activeOfferData && activeOfferData.code) ? activeOfferData.code : 'FIRST50';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showCopiedFeedback();
    }).catch(() => {
      fallbackCopyText(code);
    });
  } else {
    fallbackCopyText(code);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showCopiedFeedback();
  } catch (err) {
    prompt('Copy promo code:', text);
  }
  document.body.removeChild(textArea);
}

function showCopiedFeedback() {
  const chip = document.getElementById('banner-promo-chip');
  if (chip) {
    chip.classList.add('copied');
    setTimeout(() => {
      chip.classList.remove('copied');
    }, 2200);
  }
  showRealtimeToast('📋 Code Copied!', `Coupon code <strong>${(activeOfferData && activeOfferData.code) || 'FIRST50'}</strong> copied to clipboard.`);
}

// Claim Discount button in Offer Bar
function claimOfferDiscount(e) {
  if (e) e.preventDefault();
  const code = (activeOfferData && activeOfferData.code) ? activeOfferData.code : 'FIRST50';
  navigateToBookWithPromo(code);
}

// Navigate to Book & Pay Tab and Auto-Apply Promo
function navigateToBookWithPromo(code) {
  const targetCode = (code || (activeOfferData && activeOfferData.code) || 'FIRST50').trim().toUpperCase();

  // Push URL route without reloading
  try {
    const newUrl = `${window.location.protocol}//${window.location.host}/book?promo=${encodeURIComponent(targetCode)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  } catch (e) {}

  switchTab('book', true);
  applyPromoCode(targetCode, true);

  const bookTab = document.getElementById('tab-book');
  if (bookTab) {
    smoothScrollToElement(bookTab);
  }

  setTimeout(() => {
    const promoInput = document.getElementById('booking_promo_code');
    if (promoInput) {
      promoInput.focus();
      promoInput.select();
    }
  }, 400);
}

// Apply Promo Button click or Enter key in Booking Form
function applyBookingPromoCode() {
  const inputEl = document.getElementById('booking_promo_code');
  const code = (inputEl ? inputEl.value : '').trim();
  if (!code) {
    const alertBox = document.getElementById('promo-alert-box');
    if (alertBox) {
      alertBox.className = 'promo-alert alert-error';
      alertBox.innerHTML = `<span>⚠️</span> <div>Please enter a promo code (e.g. <strong>${(activeOfferData && activeOfferData.code) || 'FIRST50'}</strong>).</div>`;
      alertBox.classList.remove('hidden');
    }
    return;
  }
  applyPromoCode(code, true);
}

// Validate & Apply Promo Code Logic
async function applyPromoCode(rawCode, showFeedback = true) {
  const code = (rawCode || '').trim().toUpperCase();
  const alertBox = document.getElementById('promo-alert-box');
  const inputEl = document.getElementById('booking_promo_code');

  if (!code) {
    if (alertBox) {
      alertBox.className = 'promo-alert alert-error';
      alertBox.innerHTML = `<span>⚠️</span> <div>Please enter a valid coupon code.</div>`;
      alertBox.classList.remove('hidden');
    }
    return;
  }

  if (inputEl) inputEl.value = code;

  try {
    const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(code)}`);
    const data = await res.json();

    if (res.ok && data.valid) {
      appliedPromoCode = data.code;
      localStorage.setItem('sncs_applied_promo', data.code);

      const discountAmt = data.discount_amount || 50;

      if (alertBox) {
        alertBox.className = 'promo-alert alert-success';
        alertBox.innerHTML = `
          <span>✓</span>
          <div>
            <strong>${data.code} applied!</strong> ₹${Math.round(discountAmt)} off on your first booking.
            <a href="javascript:void(0)" class="promo-remove-link" onclick="removePromoCode(true)">Remove</a>
          </div>
        `;
        alertBox.classList.remove('hidden');
      }

      // Update sidebar summary discount immediately
      const sumLabel = document.getElementById('sum-discount-label');
      if (sumLabel) sumLabel.innerText = `Coupon (${data.code}):`;

      const sumVal = document.getElementById('sum-discount-val');
      if (sumVal) sumVal.innerText = `- ₹${parseFloat(discountAmt).toFixed(2)}`;

      const sumRow = document.getElementById('sum-discount-row');
      if (sumRow) sumRow.style.display = 'flex';

      // Recalculate quote with promo applied
      recalculateBookingQuote();

      if (showFeedback) {
        showRealtimeToast('🎉 Coupon Applied!', `<strong>${data.code}</strong> applied! ₹${Math.round(discountAmt)} discount activated on your booking.`);
      }
    } else {
      appliedPromoCode = "";
      localStorage.removeItem('sncs_applied_promo');

      if (alertBox) {
        alertBox.className = 'promo-alert alert-error';
        alertBox.innerHTML = `<span>⚠️</span> <div>${data.message || `Invalid coupon code '${code}'. Please check and try again.`}</div>`;
        alertBox.classList.remove('hidden');
      }

      recalculateBookingQuote();
    }
  } catch (err) {
    if (alertBox) {
      alertBox.className = 'promo-alert alert-error';
      alertBox.innerHTML = `<span>⚠️</span> <div>Network error verifying coupon code. Please retry.</div>`;
      alertBox.classList.remove('hidden');
    }
  }
}

// Remove Applied Promo Code
function removePromoCode(showToast = true) {
  appliedPromoCode = "";
  localStorage.removeItem('sncs_applied_promo');

  const inputEl = document.getElementById('booking_promo_code');
  if (inputEl) inputEl.value = "";

  const alertBox = document.getElementById('promo-alert-box');
  if (alertBox) {
    alertBox.innerHTML = "";
    alertBox.classList.add('hidden');
  }

  recalculateBookingQuote();

  if (showToast) {
    showRealtimeToast('Coupon Removed', 'Promo code discount has been removed.', false);
  }
}

// Check URL Query Parameters for Promo Code or /book Route
function checkUrlPromoParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const promo = urlParams.get('promo') || urlParams.get('code') || urlParams.get('coupon');
  const isBookPath = window.location.pathname.startsWith('/book');

  if (promo) {
    switchTab('book', false);
    applyPromoCode(promo, true);
    setTimeout(() => {
      const bookSection = document.getElementById('tab-book');
      if (bookSection) smoothScrollToElement(bookSection);
    }, 200);
  } else if (isBookPath) {
    switchTab('book', false);
    const defaultCode = (activeOfferData && activeOfferData.code) || 'FIRST50';
    applyPromoCode(defaultCode, true);
    setTimeout(() => {
      const bookSection = document.getElementById('tab-book');
      if (bookSection) smoothScrollToElement(bookSection);
    }, 200);
  } else {
    // Check localStorage for previously applied promo
    const savedPromo = localStorage.getItem('sncs_applied_promo');
    if (savedPromo) {
      applyPromoCode(savedPromo, false);
    }
  }
}

// Fetch Rates Table
async function fetchRates() {
  try {
    const res = await fetch('/api/rates');
    globalRates = await res.json();
    const tbody = document.getElementById('rates-table-body');
    if (!tbody) return;

    tbody.innerHTML = globalRates.map(r => `
      <tr>
        <td><strong>${r.zone}</strong></td>
        <td>${r.zone_name}</td>
        <td><strong style="color:#60a5fa;">₹${parseFloat(r.first_kg_price).toFixed(2)}</strong></td>
        <td>₹${parseFloat(r.extra_kg_price).toFixed(2)}</td>
        <td><span class="badge badge-info">${r.delivery_days}</span></td>
        <td>${r.hub_stops} ${r.hub_stops === 1 ? 'Direct' : 'Stops'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to fetch rates:', err);
  }
}

// ==========================================================
// 1. TRACKING LOGIC
// ==========================================================

function handleQuickTrack(e) {
  if (e && e.preventDefault) e.preventDefault();
  const val = document.getElementById('hero-track-input').value.trim();
  if (val) {
    testTrack(val, true);
  } else {
    alert('Please enter a valid tracking ID (e.g. SNCS1024)');
  }
}

function testTrack(trackingId, shouldScroll = true) {
  const trackInput = document.getElementById('track-id-input');
  if (trackInput) trackInput.value = trackingId;
  switchTab('track', false); // Avoid double-scroll, let executeTracking smoothly scroll directly to result card
  executeTracking(shouldScroll);
}

async function executeTracking(shouldScroll = false) {
  const tid = document.getElementById('track-id-input').value.trim();
  const resultArea = document.getElementById('tracking-result-area');

  if (!tid) {
    alert('Please enter a valid tracking ID (e.g. SNCS1024)');
    return;
  }

  resultArea.innerHTML = `
    <div class="card text-center" style="padding: 2.5rem;">
      <div class="pulse-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
      <p style="color: #94a3b8;">Searching SNCS consignment network for <strong>${tid}</strong>...</p>
    </div>
  `;

  if (shouldScroll) {
    const trackTab = document.getElementById('tab-track');
    smoothScrollToElement(trackTab);
  }

  try {
    const res = await fetch(`/api/track/${encodeURIComponent(tid)}`);
    const data = await res.json();

    if (!res.ok || !data.found) {
      resultArea.innerHTML = `
        <div class="card text-center" style="padding: 2.5rem; border-color: rgba(239, 68, 68, 0.4);">
          <span style="font-size: 2.5rem;">🔍</span>
          <h3 style="color: #ef4444; margin: 0.5rem 0;">Consignment Not Found</h3>
          <p style="color: #94a3b8; max-width: 480px; margin: 0 auto 1.5rem;">
            No record found for tracking ID "<strong>${tid}</strong>". Please verify the code on your receipt or contact our Ranchi counter at 7479814001.
          </p>
          <button class="btn btn-secondary" onclick="testTrack('SNCS1024', true)">Try Sample ID: SNCS1024</button>
        </div>
      `;
      if (shouldScroll) {
        smoothScrollToElement(resultArea);
      }
      return;
    }

    renderTrackingView(data);

    // Smooth-scroll directly to the tracking result console displaying Tracking ID & Status
    if (shouldScroll) {
      setTimeout(() => {
        const trackingCard = document.getElementById('tracking-scroll-wrapper') || document.getElementById('tracking-3d-card') || resultArea;
        smoothScrollToElement(trackingCard);
      }, 60);
    }
  } catch (err) {
    resultArea.innerHTML = `<div class="card text-center"><p style="color:#ef4444;">Error retrieving tracking details. Please try again.</p></div>`;
    if (shouldScroll) {
      smoothScrollToElement(resultArea);
    }
  }
}

function renderTrackingView(data) {
  const resultArea = document.getElementById('tracking-result-area');

  // Determine Stepper Stage
  // 1: Booking Confirmed, 2: Picked Up, 3: In Transit, 4: Out for Delivery, 5: Delivered
  const statusHierarchy = {
    'Booking Confirmed': 1,
    'Picked Up': 2,
    'Dispatched': 3,
    'In Transit': 3,
    'Out for Delivery': 4,
    'Delivered': 5
  };

  const currentLevel = statusHierarchy[data.current_status] || 1;
  const progressPercent = ((currentLevel - 1) / 4) * 100;

  const steps = [
    { num: 1, label: 'Booked', icon: '📝', desc: 'Ranchi Counter' },
    { num: 2, label: 'Picked Up', icon: '🛵', desc: 'Overbridge Hub' },
    { num: 3, label: 'In Transit', icon: '✈️', desc: `${data.stoppages || 1} Stoppages` },
    { num: 4, label: 'Out for Delivery', icon: '🚚', desc: 'Local Delivery' },
    { num: 5, label: 'Delivered', icon: '📦', desc: data.receiver_city }
  ];

  const flowchartHtml = `
    <div class="flowchart-container">
      <div class="flowchart-beam-track">
        <div class="flowchart-beam-fill" style="width: ${Math.max(5, progressPercent)}%;"></div>
      </div>
      ${steps.map(s => {
        let stateClass = '';
        if (s.num < currentLevel) stateClass = 'completed';
        else if (s.num === currentLevel) stateClass = 'active';
        return `
          <div class="flow-node ${stateClass}">
            <div class="flow-circle">
              ${s.num < currentLevel ? '✓' : s.icon}
            </div>
            <div class="flow-node-title">${s.label}</div>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">${s.desc}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Events Timeline
  const eventsHtml = (data.events || []).map((ev, idx) => {
    const isLatest = idx === (data.events.length - 1);
    const dateFormatted = new Date(ev.timestamp).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="timeline-item ${isLatest ? 'latest' : ''}" style="animation-delay: ${(idx * 0.08).toFixed(2)}s;">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-status">${ev.status}</span>
            <span class="timeline-time">🕒 ${dateFormatted}</span>
          </div>
          <div class="timeline-hub">📍 ${ev.hub_name}</div>
          <p class="timeline-remarks">${ev.remarks || ''}</p>
        </div>
      </div>
    `;
  }).reverse().join('');

  resultArea.innerHTML = `
    <!-- 3D ContainerScroll Wrapper (Aceternity style) -->
    <div class="container-scroll-wrapper" id="tracking-scroll-wrapper">
      
      <!-- Title Component -->
      <div class="container-scroll-title">
        <div class="live-radar-badge" style="gap: 0.5rem;">
          <span class="radar-ping"></span>
          <span>LIVE SATELLITE & HUB RADAR</span>
        </div>
        <div style="margin-top: 0.5rem;">
          <span class="live-realtime-badge">
            <span class="live-pulse-radar"></span>
            <span>Real-Time SSE Sync Active</span>
            <span style="opacity: 0.75; font-size: 0.72rem; margin-left: 0.35rem;" id="live-stream-ts">● Connected</span>
          </span>
        </div>
        <h2 class="container-scroll-heading">
          Consignment <span class="gradient-text">${data.tracking_id}</span> Flow
        </h2>
        <p class="container-scroll-sub">
          ${data.sender_city} (Origin) ➔ ${data.receiver_city} (${data.receiver_pincode}) • Live Telemetry
        </p>
      </div>

      <!-- 3D Tablet Device Bezel Mockup -->
      <div class="container-scroll-card" id="tracking-3d-card">
        
        <!-- Mockup Bezel Header -->
        <div class="container-scroll-screen-header">
          <div class="mac-dots">
            <span class="mac-dot red"></span>
            <span class="mac-dot yellow"></span>
            <span class="mac-dot green"></span>
          </div>
          <div class="screen-title-tab">
            <span class="pulse-dot-sm"></span> SNCS Live Telemetry Console • ${data.tracking_id}
          </div>
          <div class="screen-timestamp" id="tracking-screen-status">
            ● ${data.current_status.toUpperCase()}
          </div>
        </div>

        <div class="container-scroll-inner">
          <!-- Summary Header Card -->
          <div class="tracking-header-card">
            <div>
              <span class="tid-label">Consignment Tracking ID</span>
              <h1 class="tid-value">${data.tracking_id}</h1>
              <div class="tracking-route">
                <span>${data.sender_city} (Gandhi Market)</span>
                <span>→</span>
                <span style="color:#60a5fa;">${data.receiver_city} (${data.receiver_pincode})</span>
              </div>
            </div>
            <div class="text-right">
              <span class="badge ${data.current_status === 'Delivered' ? 'badge-success' : 'badge-accent'}" id="tracking-main-status-badge" style="font-size: 0.9rem; padding: 0.4rem 1rem;">
                ${data.current_status}
              </span>
              <div style="margin-top: 0.6rem; font-size: 0.82rem; color: #cbd5e1;">
                Expected Delivery: <strong style="color: white;" id="tracking-main-exp-date">${data.expected_delivery_date || 'In 1-2 Days'}</strong>
              </div>
              <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.2rem;">
                Payment: <strong style="color:#34d399;">${data.payment_status}</strong>
              </div>
            </div>
          </div>

          <!-- RANCHI OVERBRIDGE EXPRESS TRUCK SIMULATOR (Starting Super Fast -> Sudden Slow Deceleration) -->
          <div class="transit-overbridge-card" id="transitOverbridgeCard">
            <div class="overbridge-header">
              <div class="overbridge-title">
                <span class="bridge-icon">🌉</span>
                <div>
                  <strong>Ranchi Overbridge Express Transit Corridor</strong>
                  <span>Live Vehicle Sprint: ${data.sender_city} Hub ➔ ${data.receiver_city}</span>
                </div>
              </div>
              <div class="overbridge-telemetry">
                <span class="telemetry-speed-pill speed-fast" id="truckSpeedPill">
                  <span class="pulse-dot-sm"></span>
                  <span id="speedValueText">⚡ SPEED: 98 km/h (Express Burst)</span>
                </span>
                <button type="button" class="btn-replay-run" onclick="replayTruckAnimation()">
                  🔄 Replay Sprint
                </button>
              </div>
            </div>

            <div class="overbridge-stage">
              <!-- Bridge Arches & Roadway -->
              <div class="bridge-backdrop">
                <div class="bridge-arch"></div>
                <div class="bridge-arch"></div>
                <div class="bridge-arch"></div>
                <div class="bridge-arch"></div>
                <div class="bridge-arch"></div>
                <div class="milestone-post left-post">📍 ${data.sender_city}</div>
                <div class="milestone-post brake-zone-post">⚠️ Deceleration Zone</div>
                <div class="milestone-post right-post">🏁 ${data.receiver_city} Hub</div>
              </div>

              <div class="bridge-roadway">
                <div class="road-stripes"></div>
              </div>

              <!-- Animated SNCS Express Truck -->
              <div class="sncs-express-truck run-animation" id="sncsExpressTruck">
                <div class="headlight-beam"></div>
                <div class="truck-dust-plume"></div>

                <svg class="sncs-truck-svg" viewBox="0 0 160 64" fill="none">
                  <!-- Chassis -->
                  <path d="M12 56 L150 56" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
                  <rect x="6" y="52" width="148" height="4" rx="2" fill="#1e293b"/>

                  <!-- Main Cargo Container -->
                  <rect x="8" y="8" width="98" height="44" rx="5" fill="#2563eb" stroke="#1d4ed8" stroke-width="2"/>
                  <line x1="8" y1="20" x2="106" y2="20" stroke="#60a5fa" stroke-width="1.2" opacity="0.4"/>
                  <line x1="8" y1="32" x2="106" y2="32" stroke="#60a5fa" stroke-width="1.2" opacity="0.4"/>
                  <line x1="8" y1="44" x2="106" y2="44" stroke="#60a5fa" stroke-width="1.2" opacity="0.4"/>

                  <!-- SNCS Orange Stripe -->
                  <path d="M8 36 L106 36 L106 42 L8 42 Z" fill="#ff7a00"/>

                  <!-- SNCS Winged Emblem -->
                  <circle cx="56" cy="22" r="12" fill="#1e40af"/>
                  <path d="M48 22 L64 16 L58 24 Z" fill="#ffffff"/>
                  <path d="M48 22 L64 28 L58 24 Z" fill="#ff9e00"/>
                  <text x="56" y="34" font-family="'Outfit', sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">SNCS</text>

                  <!-- Driver Cab -->
                  <path d="M106 18 L130 18 L148 34 L148 52 L106 52 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" stroke-linejoin="round"/>
                  <!-- Windshield -->
                  <path d="M110 22 L128 22 L142 34 L110 34 Z" fill="#38bdf8" opacity="0.75" stroke="#0284c7" stroke-width="1.5"/>
                  <line x1="116" y1="24" x2="136" y2="33" stroke="#ffffff" stroke-width="1.2" opacity="0.6"/>

                  <!-- Front Grill & Headlights -->
                  <path d="M148 36 L156 38 L156 52 L148 52 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
                  <line x1="151" y1="42" x2="155" y2="42" stroke="#475569" stroke-width="1.5"/>
                  <line x1="151" y1="46" x2="155" y2="46" stroke="#475569" stroke-width="1.5"/>
                  <circle cx="153" cy="38" r="3" fill="#fef08a" stroke="#eab308" stroke-width="1"/>

                  <!-- Driver Silhouette -->
                  <circle cx="118" cy="28" r="3.5" fill="#1e293b"/>
                  <path d="M113 34 C113 31, 123 31, 123 34" fill="#1e293b"/>

                  <!-- Mirrors -->
                  <rect x="128" y="24" width="3" height="6" rx="1" fill="#1e293b"/>

                  <!-- Mudguards -->
                  <path d="M22 52 A 13 13 0 0 1 48 52" fill="none" stroke="#0f172a" stroke-width="3"/>
                  <path d="M68 52 A 13 13 0 0 1 94 52" fill="none" stroke="#0f172a" stroke-width="3"/>
                  <path d="M118 52 A 13 13 0 0 1 144 52" fill="none" stroke="#0f172a" stroke-width="3"/>

                  <!-- Wheels with perfect centered spin -->
                  <!-- Rear Wheel 1 -->
                  <g transform="translate(35, 52)">
                    <g class="sncs-wheel-rotator">
                      <circle cx="0" cy="0" r="11" fill="#0f172a" stroke="#334155" stroke-width="2"/>
                      <circle cx="0" cy="0" r="7" fill="#64748b"/>
                      <circle cx="0" cy="0" r="5" fill="#1e293b"/>
                      <!-- Spokes -->
                      <line x1="0" y1="-7" x2="0" y2="7" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
                      <line x1="-7" y1="0" x2="7" y2="0" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
                      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
                      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
                      <!-- Hub Cap -->
                      <circle cx="0" cy="0" r="2.2" fill="#ff7a00"/>
                      <circle cx="0" cy="0" r="1" fill="#ffffff"/>
                    </g>
                  </g>

                  <!-- Rear Wheel 2 -->
                  <g transform="translate(81, 52)">
                    <g class="sncs-wheel-rotator">
                      <circle cx="0" cy="0" r="11" fill="#0f172a" stroke="#334155" stroke-width="2"/>
                      <circle cx="0" cy="0" r="7" fill="#64748b"/>
                      <circle cx="0" cy="0" r="5" fill="#1e293b"/>
                      <!-- Spokes -->
                      <line x1="0" y1="-7" x2="0" y2="7" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
                      <line x1="-7" y1="0" x2="7" y2="0" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
                      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
                      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
                      <!-- Hub Cap -->
                      <circle cx="0" cy="0" r="2.2" fill="#ff7a00"/>
                      <circle cx="0" cy="0" r="1" fill="#ffffff"/>
                    </g>
                  </g>

                  <!-- Front Cab Wheel -->
                  <g transform="translate(131, 52)">
                    <g class="sncs-wheel-rotator">
                      <circle cx="0" cy="0" r="11" fill="#0f172a" stroke="#334155" stroke-width="2"/>
                      <circle cx="0" cy="0" r="7" fill="#64748b"/>
                      <circle cx="0" cy="0" r="5" fill="#1e293b"/>
                      <!-- Spokes -->
                      <line x1="0" y1="-7" x2="0" y2="7" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
                      <line x1="-7" y1="0" x2="7" y2="0" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
                      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
                      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
                      <!-- Hub Cap -->
                      <circle cx="0" cy="0" r="2.2" fill="#ff7a00"/>
                      <circle cx="0" cy="0" r="1" fill="#ffffff"/>
                    </g>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          <!-- Flowchart Pipeline with Animated Laser Runner -->
          <div id="tracking-flowchart-container">
            ${flowchartHtml}
          </div>

          <!-- Timeline Audit History -->
          <div class="card timeline-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 1rem;">
              <h3 style="color: var(--text-main); font-size: 1.15rem;">Shipment Milestones & Transit Log</h3>
              <span class="badge badge-info" id="tracking-scans-count">${data.events.length} Scans Recorded</span>
            </div>
            <div class="timeline-list" id="tracking-timeline-list">
              ${eventsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize Aceternity 3D Perspective Scroll & Mouse Tilt
  initContainerScroll3D();
  initTruckTelemetry();

  // Initialize Real-Time SSE Stream for this Consignment
  initRealtimeTrackingStream(data.tracking_id);
}

// ==========================================================
// REAL-TIME CLIENT LOGIC (Server-Sent Events)
// ==========================================================
function initRealtimeTrackingStream(trackingId) {
  if (window._trackingEventSource) {
    window._trackingEventSource.close();
    window._trackingEventSource = null;
  }

  const cleanId = trackingId.trim().toUpperCase();
  const es = new EventSource(`/api/stream/track/${encodeURIComponent(cleanId)}`);
  window._trackingEventSource = es;

  es.addEventListener('connected', () => {
    const tsEl = document.getElementById('live-stream-ts');
    if (tsEl) tsEl.innerText = '● Live Feed Synchronized';
  });

  es.addEventListener('update', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleLiveTrackingUpdate(data);
    } catch (err) {
      console.error('Error handling live update:', err);
    }
  });

  es.onerror = () => {
    const tsEl = document.getElementById('live-stream-ts');
    if (tsEl) tsEl.innerText = '⚠️ Reconnecting...';
  };
}

function handleLiveTrackingUpdate(update) {
  // 1. Play audio chime
  playAudioNotification();

  // 2. Show floating toast
  showRealtimeToast(
    '⚡ Live Consignment Update',
    `Status updated to <strong>${update.current_status}</strong> at <strong>${update.current_hub}</strong>.`
  );

  // 3. Update status badge & header
  const badge = document.getElementById('tracking-main-status-badge');
  if (badge) {
    badge.innerText = update.current_status;
    badge.className = `badge ${update.current_status === 'Delivered' ? 'badge-success' : 'badge-accent'}`;
  }

  const screenStatus = document.getElementById('tracking-screen-status');
  if (screenStatus) {
    screenStatus.innerText = `● ${update.current_status.toUpperCase()}`;
  }

  // 4. Update flowchart stepper stages
  const statusHierarchy = {
    'Booking Confirmed': 1,
    'Picked Up': 2,
    'Dispatched': 3,
    'In Transit': 3,
    'Out for Delivery': 4,
    'Delivered': 5
  };
  const newLevel = statusHierarchy[update.current_status] || 1;
  const progressPercent = ((newLevel - 1) / 4) * 100;

  const beamFill = document.querySelector('.flowchart-beam-fill');
  if (beamFill) {
    beamFill.style.width = `${Math.max(5, progressPercent)}%`;
  }

  const nodes = document.querySelectorAll('.flowchart-container .flow-node');
  nodes.forEach((node, idx) => {
    const stepNum = idx + 1;
    node.classList.remove('completed', 'active');
    const circle = node.querySelector('.flow-circle');
    if (stepNum < newLevel) {
      node.classList.add('completed');
      if (circle) circle.innerText = '✓';
    } else if (stepNum === newLevel) {
      node.classList.add('active');
    }
  });

  // 5. Prepend new timeline event item
  const timelineList = document.getElementById('tracking-timeline-list');
  if (timelineList) {
    timelineList.querySelectorAll('.timeline-item').forEach(item => item.classList.remove('latest'));

    const dateFormatted = new Date(update.timestamp || Date.now()).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const newItem = document.createElement('div');
    newItem.className = 'timeline-item timeline-item-new latest';
    newItem.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-status">${update.current_status}</span>
          <span class="timeline-time">🕒 ${dateFormatted}</span>
        </div>
        <div class="timeline-hub">📍 ${update.current_hub}</div>
        <p class="timeline-remarks">${update.remarks || ''}</p>
      </div>
    `;
    timelineList.insertBefore(newItem, timelineList.firstChild);

    const scansCount = document.getElementById('tracking-scans-count');
    if (scansCount) {
      const currentCount = timelineList.children.length;
      scansCount.innerText = `${currentCount} Scans Recorded`;
    }
  }

  // 6. Trigger truck animation replay
  replayTruckAnimation();
}

function playAudioNotification() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

function showRealtimeToast(title, message, isSuccess = true) {
  let container = document.getElementById('sncs-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sncs-toast-container';
    container.className = 'sncs-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `sncs-toast ${isSuccess ? 'toast-success' : ''}`;
  toast.innerHTML = `
    <span style="font-size: 1.3rem;">${isSuccess ? '📦' : 'ℹ️'}</span>
    <div style="flex: 1;">
      <div style="font-weight: 700; font-size: 0.88rem; color: #f8fafc; margin-bottom: 0.15rem;">${title}</div>
      <div style="color: #cbd5e1; font-size: 0.8rem; line-height: 1.4;">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 350);
  }, 4200);
}


let truckTelemetryTimer = null;

function replayTruckAnimation() {
  const truck = document.getElementById('sncsExpressTruck');
  if (!truck) return;

  truck.classList.remove('run-animation');
  void truck.offsetWidth; // force reflow
  truck.classList.add('run-animation');

  initTruckTelemetry();
}

function initTruckTelemetry() {
  const pill = document.getElementById('truckSpeedPill');
  const text = document.getElementById('speedValueText');
  if (!pill || !text) return;

  if (truckTelemetryTimer) {
    clearInterval(truckTelemetryTimer);
  }

  // Phase 1 (0 to 2.1s): Fast speed burst
  pill.className = 'telemetry-speed-pill speed-fast';
  text.innerText = '⚡ SPEED: 98 km/h (Express Highway Burst)';

  // Phase 2 (at 2.1s): Sudden braking and slow crawl
  setTimeout(() => {
    if (!pill || !text) return;
    pill.className = 'telemetry-speed-pill speed-slow';
    text.innerText = '⚠️ DECELERATING: 18 km/h (Hub Approach)';
  }, 2100);

  // Phase 3 (at 6.4s): Station arrival
  setTimeout(() => {
    if (!pill || !text) return;
    pill.className = 'telemetry-speed-pill';
    text.innerText = '🏁 ARRIVING AT DESTINATION HUB';
  }, 6400);

  // Periodic refresh matching animation loop (7.5s)
  truckTelemetryTimer = setInterval(() => {
    if (!pill || !text) return;
    pill.className = 'telemetry-speed-pill speed-fast';
    text.innerText = '⚡ SPEED: 98 km/h (Express Highway Burst)';
    setTimeout(() => {
      if (!pill || !text) return;
      pill.className = 'telemetry-speed-pill speed-slow';
      text.innerText = '⚠️ DECELERATING: 18 km/h (Hub Approach)';
    }, 2100);
    setTimeout(() => {
      if (!pill || !text) return;
      pill.className = 'telemetry-speed-pill';
      text.innerText = '🏁 ARRIVING AT DESTINATION HUB';
    }, 6400);
  }, 7500);
}

function initContainerScroll3D() {
  const card = document.getElementById('tracking-3d-card');
  if (!card) return;

  function handleScroll() {
    const rect = card.getBoundingClientRect();
    const windowH = window.innerHeight;
    
    // Progress: 0 when card is below viewport, 1 when scrolled into center
    const progress = Math.max(0, Math.min(1, (windowH - rect.top) / (windowH * 0.75)));
    
    const tilt = 18 * (1 - progress);
    const scale = 0.94 + (0.06 * progress);
    const translateY = 25 * (1 - progress);

    card.style.transform = `rotateX(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)}) translateY(${translateY.toFixed(1)}px)`;
  }

  // Interactive 3D mouse move tilt
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateY = (x / (rect.width / 2)) * 6;
    const rotateX = -(y / (rect.height / 2)) * 6;
    card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.008)`;
  });

  card.addEventListener('mouseleave', () => {
    handleScroll();
  });

  if (window._sncsScrollHandler) {
    window.removeEventListener('scroll', window._sncsScrollHandler);
  }
  window._sncsScrollHandler = handleScroll;
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

// ==========================================================
// 2. BOOKING LOGIC & REAL-TIME QUOTE
// ==========================================================

async function checkFirstBookingDiscount(mobile) {
  const tip = document.getElementById('mobile-discount-tip');
  if (!mobile || mobile.length < 10) {
    tip.innerText = "Enter 10-digit mobile number to check ₹50 welcome discount eligibility.";
    tip.style.color = "#94a3b8";
    bookingDiscount = 0.0;
    recalculateBookingQuote();
    return;
  }

  try {
    const res = await fetch(`/api/customer/check-discount?mobile=${mobile}`);
    const data = await res.json();
    if (data.first_booking_available) {
      tip.innerText = "🎉 Congratulations! ₹50 First Booking Welcome Discount Applied.";
      tip.style.color = "#34d399";
      bookingDiscount = 50.0;
    } else {
      tip.innerText = "Welcome back! Standard express courier rates apply.";
      tip.style.color = "#93c5fd";
      bookingDiscount = 0.0;
    }
  } catch (e) {
    bookingDiscount = 0.0;
  }
  recalculateBookingQuote();
}

let isBookingDestinationServiceable = false;

function updateBookingSubmitButtonState() {
  const submitBtn = document.getElementById('book-submit-btn');
  if (!submitBtn) return;

  const pinInput = document.getElementById('receiver_pincode');
  const pin = (pinInput ? pinInput.value : '').trim();

  if (isBookingDestinationServiceable) {
    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-disabled-unreachable');
    submitBtn.innerHTML = `<span>Confirm & Generate Booking Receipt</span><span>→</span>`;
    submitBtn.title = "Proceed to confirm booking";
  } else if (pin.length === 6) {
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-disabled-unreachable');
    submitBtn.innerHTML = `<span>🚫 Unreachable Destination - Booking Disabled</span>`;
    submitBtn.title = "Booking cannot be placed: Destination location is Unreachable.";
  } else {
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-disabled-unreachable');
    submitBtn.innerHTML = `<span>Enter Serviceable Destination PIN to Book</span><span>→</span>`;
    submitBtn.title = "Please enter a valid 6-digit serviceable PIN code.";
  }
}

async function handleBookingPinChange(rawPin) {
  const pin = (rawPin || '').trim();
  const statusEl = document.getElementById('booking-pin-status');
  const cityInput = document.getElementById('receiver_city');

  if (!statusEl || !cityInput) return;

  if (pin.length === 0) {
    statusEl.innerHTML = `<span class="tip-text" style="color: #94a3b8;">Enter 6-digit destination PIN code to detect city & serviceability.</span>`;
    cityInput.value = "";
    isBookingDestinationServiceable = false;
    updateBookingSubmitButtonState();
    return;
  }

  if (pin.length < 6) {
    statusEl.innerHTML = `<span class="tip-text" style="color: #94a3b8;">Entering PIN (${pin.length}/6 digits)...</span>`;
    cityInput.value = "";
    isBookingDestinationServiceable = false;
    updateBookingSubmitButtonState();
    return;
  }

  if (pin.length > 6 || !/^\d{6}$/.test(pin)) {
    statusEl.innerHTML = `<span class="pin-status-chip chip-invalid">⚠️ <strong>Invalid PIN:</strong> Must be exactly 6 digits.</span>`;
    cityInput.value = "";
    isBookingDestinationServiceable = false;
    updateBookingSubmitButtonState();
    return;
  }

  statusEl.innerHTML = `<span class="pin-status-chip chip-loading">🔄 Checking city coverage for PIN ${pin}...</span>`;

  try {
    const res = await fetch(`/api/pincodes/check?pincode=${pin}`);
    const data = await res.json();

    if (res.ok && data.valid && data.serviceable) {
      // 1. Serviceable: Auto-fill city, display green status, enable booking
      cityInput.value = data.city;
      statusEl.innerHTML = `<span class="pin-status-chip chip-serviceable">✓ <strong>Serviceable:</strong> ${data.city} (${data.zone}) • Delivery in ${data.tat_days}</span>`;
      isBookingDestinationServiceable = true;
      updateBookingSubmitButtonState();

      if (document.getElementById('summary-zone-badge')) {
        document.getElementById('summary-zone-badge').innerText = data.zone;
        document.getElementById('summary-zone-badge').className = "badge badge-accent";
      }
      if (document.getElementById('sum-tat')) {
        document.getElementById('sum-tat').innerText = data.tat_days;
      }
      recalculateBookingQuote();
    } else if (data.valid && !data.serviceable) {
      // 2. City recognized, but UNREACHABLE: Auto-fill city, show Unreachable status in red, disable booking
      cityInput.value = data.city;
      statusEl.innerHTML = `<span class="pin-status-chip chip-unreachable">🚫 <strong>Unreachable:</strong> ${data.city} is not covered by our service network. Booking disabled.</span>`;
      isBookingDestinationServiceable = false;
      updateBookingSubmitButtonState();

      if (document.getElementById('summary-zone-badge')) {
        document.getElementById('summary-zone-badge').innerText = "Unreachable";
        document.getElementById('summary-zone-badge').className = "badge badge-danger";
      }
      if (document.getElementById('sum-tat')) {
        document.getElementById('sum-tat').innerText = "Service Unavailable";
      }
      if (document.getElementById('sum-base-price')) {
        document.getElementById('sum-base-price').innerText = "N/A";
      }
      if (document.getElementById('sum-final-price')) {
        document.getElementById('sum-final-price').innerText = "N/A (Unreachable)";
      }
      if (document.getElementById('sum-stops')) {
        document.getElementById('sum-stops').innerText = "No Service";
      }
    } else {
      // 3. Invalid PIN or No City Data Available
      cityInput.value = "";
      statusEl.innerHTML = `<span class="pin-status-chip chip-invalid">⚠️ <strong>Invalid PIN:</strong> ${data.message || 'No city data available for this PIN code.'}</span>`;
      isBookingDestinationServiceable = false;
      updateBookingSubmitButtonState();

      if (document.getElementById('summary-zone-badge')) {
        document.getElementById('summary-zone-badge').innerText = "Invalid PIN";
        document.getElementById('summary-zone-badge').className = "badge badge-danger";
      }
      if (document.getElementById('sum-tat')) {
        document.getElementById('sum-tat').innerText = "--";
      }
      if (document.getElementById('sum-base-price')) {
        document.getElementById('sum-base-price').innerText = "₹ --";
      }
      if (document.getElementById('sum-final-price')) {
        document.getElementById('sum-final-price').innerText = "₹ --";
      }
    }
  } catch (err) {
    statusEl.innerHTML = `<span class="pin-status-chip chip-invalid">⚠️ Network error checking PIN code. Please retry.</span>`;
    isBookingDestinationServiceable = false;
    updateBookingSubmitButtonState();
  }
}

async function recalculateBookingQuote() {
  const actualW = parseFloat(document.getElementById('pkg_weight')?.value || 1.0);
  const l = parseFloat(document.getElementById('pkg_len')?.value || 20);
  const w = parseFloat(document.getElementById('pkg_width')?.value || 15);
  const h = parseFloat(document.getElementById('pkg_height')?.value || 10);
  const pin = (document.getElementById('receiver_pincode')?.value || '').trim();
  const mobile = document.getElementById('sender_mobile')?.value || '';
  const promoToSend = (appliedPromoCode || document.getElementById('booking_promo_code')?.value || '').trim().toUpperCase();

  const volW = Math.round(((l * w * h) / 5000) * 100) / 100;
  const chargeW = Math.max(0.5, Math.max(actualW, volW));

  document.getElementById('sum-actual-w').innerText = `${actualW.toFixed(1)} kg`;
  document.getElementById('sum-vol-w').innerText = `${volW.toFixed(1)} kg`;
  document.getElementById('sum-charge-w').innerText = `${chargeW.toFixed(1)} kg`;

  if (!pin || pin.length !== 6 || !isBookingDestinationServiceable) {
    if (pin.length === 6 && !isBookingDestinationServiceable) {
      document.getElementById('summary-zone-badge').innerText = "Unreachable";
      document.getElementById('summary-zone-badge').className = "badge badge-danger";
      document.getElementById('sum-tat').innerText = "Service Unavailable";
      document.getElementById('sum-base-price').innerText = "N/A";
      document.getElementById('sum-final-price').innerText = "N/A (Unreachable)";
      document.getElementById('sum-stops').innerText = "No Service";
    }
    return;
  }

  try {
    const res = await fetch('/api/rates/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actual_weight: actualW,
        length: l,
        width: w,
        height: h,
        destination_pincode: pin,
        sender_mobile: mobile,
        promo_code: promoToSend
      })
    });
    const quote = await res.json();

    if (!quote.serviceable) {
      document.getElementById('summary-zone-badge').innerText = "Unreachable";
      document.getElementById('summary-zone-badge').className = "badge badge-danger";
      document.getElementById('sum-tat').innerText = "Service Unavailable";
      document.getElementById('sum-base-price').innerText = "N/A";
      document.getElementById('sum-final-price').innerText = "N/A (Unreachable)";
      document.getElementById('sum-stops').innerText = "No Service";
      return;
    }

    document.getElementById('sum-base-price').innerText = `₹${quote.base_amount.toFixed(2)}`;
    document.getElementById('summary-zone-badge').innerText = quote.zone;
    document.getElementById('summary-zone-badge').className = "badge badge-accent";
    document.getElementById('sum-tat').innerText = quote.delivery_days;
    document.getElementById('sum-stops').innerText = `${quote.hub_stops} ${quote.hub_stops === 1 ? 'Direct Hub' : 'Hub Stops'}`;

    if (quote.discount > 0) {
      document.getElementById('sum-discount-row').style.display = 'flex';
      document.getElementById('sum-discount-val').innerText = `- ₹${quote.discount.toFixed(2)}`;
      const labelEl = document.getElementById('sum-discount-label');
      if (labelEl) {
        labelEl.innerText = quote.promo_code ? `Coupon (${quote.promo_code}):` : "First Booking Offer:";
      }
    } else {
      document.getElementById('sum-discount-row').style.display = 'none';
    }

    document.getElementById('sum-final-price').innerText = `₹${quote.final_amount.toFixed(2)}`;
  } catch (err) {
    console.error('Calculation error:', err);
  }
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('book-submit-btn');

  if (!isBookingDestinationServiceable) {
    showRealtimeToast('Booking Restricted', 'Cannot create booking: Selected destination location is Unreachable.', false);
    alert('Booking cannot be placed: Destination location is Unreachable or not covered by our service network. Please enter a serviceable destination PIN code.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = "Processing Booking & Pickup Request...";

  const promoToSend = (appliedPromoCode || document.getElementById('booking_promo_code')?.value || '').trim().toUpperCase();

  const payload = {
    sender_name: document.getElementById('sender_name').value.trim(),
    sender_mobile: document.getElementById('sender_mobile').value.trim(),
    sender_email: document.getElementById('sender_email').value.trim(),
    sender_address: document.getElementById('sender_address').value.trim(),
    sender_pincode: document.getElementById('sender_pincode').value.trim(),
    sender_city: "Ranchi",

    receiver_name: document.getElementById('receiver_name').value.trim(),
    receiver_mobile: document.getElementById('receiver_mobile').value.trim(),
    receiver_address: document.getElementById('receiver_address').value.trim(),
    receiver_pincode: document.getElementById('receiver_pincode').value.trim(),
    receiver_city: document.getElementById('receiver_city').value.trim(),

    package_type: document.getElementById('package_type').value,
    actual_weight: parseFloat(document.getElementById('pkg_weight').value),
    length: parseFloat(document.getElementById('pkg_len').value),
    width: parseFloat(document.getElementById('pkg_width').value),
    height: parseFloat(document.getElementById('pkg_height').value),
    payment_method: document.querySelector('input[name="payment_mode"]:checked').value,
    promo_code: promoToSend
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      alert(result.message || 'Error creating booking. Please check the form.');
      updateBookingSubmitButtonState();
      return;
    }

    lastCreatedBooking = {
      ...payload,
      tracking_id: result.tracking_id,
      amount: result.amount,
      discount: result.discount_applied,
      expected_delivery_date: result.expected_delivery_date
    };

    // Show Receipt Modal
    displayReceiptModal(lastCreatedBooking);

    // Reset Form
    document.getElementById('parcel-booking-form').reset();
    document.getElementById('sender_pincode').value = "834001";
    isBookingDestinationServiceable = false;
    updateBookingSubmitButtonState();
    removePromoCode(false);
  } catch (err) {
    alert("Connection error. Please try again.");
  } finally {
    updateBookingSubmitButtonState();
  }
}

function displayReceiptModal(booking) {
  document.getElementById('modal-tracking-id').innerText = booking.tracking_id;
  document.getElementById('modal-payment-badge').innerText = (booking.payment_method.startsWith('Online')) ? 'PAID ONLINE' : 'CASH ON PICKUP';
  document.getElementById('modal-sender-text').innerText = `${booking.sender_name} (Mob: ${booking.sender_mobile}) - ${booking.sender_address}, Ranchi`;
  document.getElementById('modal-receiver-text').innerText = `${booking.receiver_name} (Mob: ${booking.receiver_mobile}) - ${booking.receiver_city} (${booking.receiver_pincode})`;
  document.getElementById('modal-weight-text').innerText = `${booking.actual_weight} kg (Type: ${booking.package_type})`;
  document.getElementById('modal-delivery-text').innerText = booking.expected_delivery_date;
  document.getElementById('modal-paymode-text').innerText = booking.payment_method;
  document.getElementById('modal-amount-text').innerText = `₹${booking.amount.toFixed(2)}`;

  document.getElementById('booking-receipt-modal').classList.remove('hidden');
}

function closeReceiptModal() {
  document.getElementById('booking-receipt-modal').classList.add('hidden');
}

function shareReceiptWhatsApp() {
  if (!lastCreatedBooking) return;
  const msg = encodeURIComponent(
    `📦 *Shri Network Courier Services (SNCS) Booking Receipt*\n` +
    `• Tracking ID: *${lastCreatedBooking.tracking_id}*\n` +
    `• Sender: ${lastCreatedBooking.sender_name} (Ranchi)\n` +
    `• Receiver: ${lastCreatedBooking.receiver_name} (${lastCreatedBooking.receiver_city})\n` +
    `• Expected Delivery: ${lastCreatedBooking.expected_delivery_date}\n` +
    `• Total Amount: ₹${lastCreatedBooking.amount}\n\n` +
    `Track Live: http://${window.location.host}/#tab-track`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function viewReceiptInTracker() {
  if (!lastCreatedBooking) return;
  closeReceiptModal();
  testTrack(lastCreatedBooking.tracking_id);
}

// ==========================================================
// 3. LIVE PRICE CALCULATOR TAB
// ==========================================================

async function runLiveCalculator() {
  const zone = document.getElementById('calc-destination-zone').value;
  const actualW = parseFloat(document.getElementById('calc-actual-weight').value || 1.0);
  const l = parseFloat(document.getElementById('calc-len').value || 0);
  const w = parseFloat(document.getElementById('calc-width').value || 0);
  const h = parseFloat(document.getElementById('calc-height').value || 0);

  try {
    const res = await fetch('/api/rates/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone: zone,
        actual_weight: actualW,
        length: l,
        width: w,
        height: h
      })
    });
    const data = await res.json();

    document.getElementById('calc-total-display').innerText = `₹${data.final_amount.toFixed(2)}`;
    document.getElementById('calc-tat-display').innerText = data.delivery_days;
    document.getElementById('calc-stops-display').innerText = `${data.hub_stops} Hub Stoppages`;
    document.getElementById('calc-ch-weight-display').innerText = `${data.chargeable_weight.toFixed(1)} kg`;
    document.getElementById('calc-base-display').innerText = `₹${data.base_amount.toFixed(2)}`;

    const extraAmount = Math.max(0, data.base_amount - (data.zone === 'Zone 1' ? 40 : (data.zone === 'Zone 2' ? 60 : 110)));
    document.getElementById('calc-extra-display').innerText = `₹${extraAmount.toFixed(2)}`;
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================
// 4. PINCODE CHECKER TAB
// ==========================================================

function checkSpecificPin(pin) {
  document.getElementById('pincode-search-input').value = pin;
  executePincodeCheck();
}

async function executePincodeCheck() {
  const pin = document.getElementById('pincode-search-input').value.trim();
  const resultBox = document.getElementById('pincode-result-box');

  if (pin.length !== 6 || isNaN(pin)) {
    alert('Please enter a valid 6-digit Indian PIN code.');
    return;
  }

  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `<p style="color:#94a3b8;">Verifying serviceability for PIN <strong>${pin}</strong>...</p>`;

  try {
    const res = await fetch(`/api/pincodes/check?pincode=${pin}`);
    const data = await res.json();

    if (data.valid && data.serviceable) {
      resultBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="badge badge-success" style="font-size: 0.85rem;">✓ SERVICEABLE & PICKUP AVAILABLE</span>
            <h3 style="color: white; margin: 0.5rem 0 0.2rem;">PIN: ${data.pincode} - ${data.city}</h3>
            <p style="color: #93c5fd; font-size: 0.9rem;">State: ${data.state} • Routing: ${data.zone}</p>
          </div>
          <div class="text-right">
            <div style="font-size: 0.8rem; color: #94a3b8;">Estimated Delivery</div>
            <strong style="color: #60a5fa; font-size: 1.25rem;">${data.tat_days}</strong>
            <div style="font-size: 0.78rem; color: #34d399; margin-top: 0.25rem;">💵 Cash on Pickup: Available</div>
          </div>
        </div>
        <div style="margin-top: 1.25rem; border-top: 1px solid var(--border-light); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem; color: #cbd5e1;">Ready to dispatch from Ranchi Gandhi Market Overbridge Hub?</span>
          <button class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.85rem;" onclick="prefillBookingPin('${data.pincode}')">Book for this PIN →</button>
        </div>
      `;
    } else if (data.valid && !data.serviceable) {
      resultBox.innerHTML = `
        <div style="color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.25);">
          <span class="badge badge-danger">🚫 UNREACHABLE LOCATION</span>
          <h3 style="margin-top: 0.5rem; color: #f87171;">PIN: ${data.pincode} - ${data.city}</h3>
          <p style="color: #cbd5e1; font-size: 0.9rem; margin-top: 0.35rem;">
            This destination is outside the SNCS service coverage network and is currently <strong>Unreachable</strong>. Online bookings cannot be placed for this destination.
          </p>
          <p style="color: #94a3b8; font-size: 0.82rem; margin-top: 0.5rem;">
            For special business inquiries or charter transit from Ranchi, contact central dispatch at <strong>+91 7479814001</strong>.
          </p>
        </div>
      `;
    } else {
      resultBox.innerHTML = `
        <div style="color: #f59e0b; background: rgba(245, 158, 11, 0.08); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.25);">
          <span class="badge badge-accent">⚠️ INVALID PIN CODE</span>
          <h3 style="margin-top: 0.5rem; color: #fbbf24;">PIN Code ${pin}</h3>
          <p style="color: #cbd5e1; font-size: 0.9rem; margin-top: 0.35rem;">${data.message || 'No city data available for this PIN code. Please enter a valid 6-digit Indian postal code.'}</p>
        </div>
      `;
    }
  } catch (err) {
    resultBox.innerHTML = `<p style="color:#ef4444;">Error checking pin code.</p>`;
  }
}

function prefillBookingPin(pin) {
  switchTab('book');
  const receiverPin = document.getElementById('receiver_pincode');
  if (receiverPin) {
    receiverPin.value = pin;
    handleBookingPinChange(pin);
  }
}

// Dynamic Step Progression Highlight for 4-Step Booking Form
function setupBookingStepTracker() {
  const step1Inputs = ['sender_name', 'sender_mobile', 'sender_address', 'sender_pincode'];
  const step2Inputs = ['receiver_name', 'receiver_mobile', 'receiver_pincode', 'receiver_address'];
  
  function updateStepStatus() {
    const s1Complete = step1Inputs.every(id => {
      const el = document.getElementById(id);
      return el && el.value.trim().length > 0;
    });
    const block1 = document.getElementById('step-block-1');
    const block2 = document.getElementById('step-block-2');
    const block3 = document.getElementById('step-block-3');
    const block4 = document.getElementById('step-block-4');
    
    if (block1) block1.classList.toggle('step-completed', s1Complete);
    if (block2) {
      block2.classList.toggle('step-active', s1Complete);
      const s2Complete = step2Inputs.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim().length > 0;
      });
      block2.classList.toggle('step-completed', s2Complete);
      if (block3) {
        block3.classList.toggle('step-active', s2Complete);
        const w = parseFloat(document.getElementById('pkg_weight')?.value || 0);
        const s3Complete = w > 0;
        block3.classList.toggle('step-completed', s3Complete && s2Complete);
        if (block4) {
          block4.classList.toggle('step-active', s3Complete && s2Complete);
        }
      }
    }
  }

  [...step1Inputs, ...step2Inputs, 'pkg_weight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateStepStatus);
      el.addEventListener('change', updateStepStatus);
    }
  });
  updateStepStatus();
}

