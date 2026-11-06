# Shri Network Courier Services (SNCS) - Full Web Application

**Location:** Gandhi Market, near Basera Hotel overbridge, Ranchi, Jharkhand 834001  
**Helpline:** +91 7479814001, +91 6291414573  
**Email:** priyanshujha@gmail.com  
**Counter Timings:** 9:00 AM to 10:00 PM (All 7 Days)

---

## 🚀 Live Local URLs
- **Customer Portal:** [http://localhost:5005](http://localhost:5005)
- **Staff & Owner Admin Portal:** [http://localhost:5005/admin](http://localhost:5005/admin)
  - **Username:** `admin` (or `staff`)
  - **Password:** `admin123` (or `sncs834001`)

---

## 🌟 Key Features Implemented

### 1. Customer Portal (`/`)
- **Hero & Trust Badges:** Ranchi same-day doorstep pickup, 20,000+ pincodes, flat ₹50 welcome discount, 100% insured transit.
- **Dynamic Festive Offer Banner:** Live banner with discount rules, customizable from admin.
- **Real-Time Consignment Tracking:**
  - Visual 5-stage milestone stepper (Booked → Picked Up → In Transit → Out for Delivery → Delivered).
  - Transit stoppages counter and expected delivery date.
  - Full audit timeline with hub scan locations and rider remarks.
  - Pre-seeded test tracking numbers: `SNCS1024`, `SNCS1025`, `SNCS1026`.
- **Doorstep Pickup & Booking Flow:**
  - Sender details auto-anchored in Ranchi (834001, Gandhi Market / Overbridge).
  - Pincode auto-lookup for destination cities.
  - Real-time volumetric weight computation: `max(actual_weight, L×W×H ÷ 5000)`.
  - Automatic ₹50 first-user discount verification on typing 10-digit mobile number.
  - Payment options: Online UPI/Card (Razorpay simulation) or Cash at Doorstep Pickup.
  - Printable booking receipt with 1-click WhatsApp sharing (`https://wa.me/?text=...`) and direct tracking button.
- **Tariff & Price Calculator:**
  - Interactive estimate breakdown (Base rate + Extra kg rate - Welcome discount).
  - Full official rate card table for Zone 1 (Ranchi Local), Zone 2 (Jharkhand State), Zone 3 (Metro), and Zone 4 (Rest of India).
- **Pincode Coverage Directory:**
  - Instant 6-digit PIN lookup with Turnaround Time (TAT) and Cash on Pickup indicator.
- **Multilingual Support:** One-click English & Hindi (`हिंदी / ENG`) toggle.

### 2. Staff & Owner Admin Portal (`/admin`)
- **Operations Dashboard:**
  - Real-time stats: Total Bookings, In Transit Parcels, Out for Delivery, Delivered Today, Pending Pickups, Total Revenue (₹).
- **Consignment Management & Live Hub Updates:**
  - Filter bookings by status, search by phone, tracking ID, or city.
  - 1-Click Status Modal: Update status (Picked Up, In Transit, Out for Delivery, Delivered), select current hub location, and add transit remarks that appear on the customer tracking timeline.
- **Zone Rate Configuration:**
  - Edit 1st kg price, extra kg price, and delivery days directly from the UI.
- **Pincode Directory Management:**
  - Add or update serviceable pincodes and delivery TAT.
- **Festive Offer & Banner Control:**
  - Edit promo text, discount amount, and toggle website visibility ON/OFF.
- **Daily Operations Report:**
  - 1-Click CSV/Excel report download (`/api/admin/export-csv`).

---

## 📁 Project Architecture

```
sncs_project/
├── app.py                      # Flask backend application with REST APIs & auth
├── database.py                 # SQLite database schema, initialization & seed data
├── sncs.db                     # Persistent SQLite database
├── start.sh                    # One-command startup script
├── templates/
│   ├── index.html              # Customer-facing website
│   └── admin.html              # Staff & Owner operations portal
├── static/
│   ├── css/
│   │   └── style.css           # Premium responsive styling (Inter/Outfit, Glassmorphism)
│   ├── js/
│   │   ├── app.js              # Client-side tracking, booking wizard, calculator
│   │   └── admin.js            # Admin portal SPA logic
│   └── images/
│       └── hero.jpg            # Generated 3D express logistics banner
├── SNCS_Implementation_Plan.md # Original planning specification
└── README.md                   # Documentation
```

---

## 🛠️ How to Run Locally

### Option 1: Start Script
```bash
./start.sh
```

### Option 2: Direct Python Command
```bash
.venv/bin/python app.py
```
Open `http://localhost:5005` in your browser.
