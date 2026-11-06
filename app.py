import os
import math
import csv
import io
import json
import time
import queue
import threading
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, Response, session
from flask_cors import CORS
from database import get_db_connection, init_db, hash_password
from pincode_data import lookup_indian_pincode_city

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "static"),
    template_folder=os.path.join(BASE_DIR, "templates")
)
app.secret_key = "sncs_ranchi_courier_secret_key_834001"
CORS(app)

# Ensure DB is initialized
init_db()

# --- REAL-TIME PUB/SUB EVENT BUS (SSE) ---
class SSEEventBus:
    def __init__(self):
        self.subscribers = {}  # channel -> set of queue.Queue
        self.lock = threading.Lock()

    def subscribe(self, channel):
        q = queue.Queue(maxsize=100)
        with self.lock:
            if channel not in self.subscribers:
                self.subscribers[channel] = set()
            self.subscribers[channel].add(q)
        return q

    def unsubscribe(self, channel, q):
        with self.lock:
            if channel in self.subscribers:
                self.subscribers[channel].discard(q)
                if not self.subscribers[channel]:
                    del self.subscribers[channel]

    def publish(self, channel, data):
        with self.lock:
            if channel in self.subscribers:
                for q in list(self.subscribers[channel]):
                    try:
                        q.put_nowait(data)
                    except queue.Full:
                        pass

event_bus = SSEEventBus()
active_simulations = {}


# --- HELPER FUNCTIONS ---
def generate_tracking_id(cursor):
    cursor.execute("SELECT id FROM bookings ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    next_num = 1027 if not row else 1024 + row["id"] + 1
    return f"SNCS{next_num}"

def calculate_chargeable_weight(actual_w, l, w, h):
    try:
        actual_w = float(actual_w or 0.5)
        l = float(l or 0)
        w = float(w or 0)
        h = float(h or 0)
    except (ValueError, TypeError):
        actual_w = 0.5
        l = w = h = 0

    volumetric_w = round((l * w * h) / 5000.0, 2)
    chargeable_w = max(actual_w, volumetric_w)
    # Minimum chargeable weight is 0.5 kg
    chargeable_w = max(0.5, round(chargeable_w, 2))
    return actual_w, volumetric_w, chargeable_w

# --- PAGE ROUTES ---
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/admin")
def admin_page():
    return render_template("admin.html")

# --- PUBLIC APIS ---

# 1. Active Festive Offers
@app.route("/api/offers", methods=["GET"])
def get_offers():
    conn = get_db_connection()
    offer = conn.execute("SELECT * FROM offers WHERE is_active = 1 ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    if offer:
        return jsonify({
            "id": offer["id"],
            "title": offer["title"],
            "text": offer["text"],
            "discount_amount": offer["discount_amount"],
            "is_active": bool(offer["is_active"])
        })
    return jsonify({"is_active": False})

# 2. Check Pincode
@app.route("/api/pincodes/check", methods=["GET"])
def check_pincode():
    pin = request.args.get("pincode", "").strip()
    if not pin or len(pin) != 6 or not pin.isdigit():
        return jsonify({
            "valid": False,
            "serviceable": False,
            "status": "Invalid",
            "message": "Please enter a valid 6-digit PIN code."
        }), 400

    conn = get_db_connection()
    row = conn.execute("SELECT * FROM pincodes WHERE pincode = ?", (pin,)).fetchone()
    conn.close()

    if row:
        is_serv = bool(row["serviceable"])
        return jsonify({
            "valid": True,
            "serviceable": is_serv,
            "status": "Serviceable" if is_serv else "Unreachable",
            "pincode": row["pincode"],
            "city": row["city"],
            "state": row["state"],
            "zone": row["zone"],
            "cod_available": bool(row["cod_available"]) if is_serv else False,
            "tat_days": row["tat_days"] if is_serv else "N/A",
            "message": f"Serviceable destination: {row['city']} ({row['tat_days']})" if is_serv else f"Unreachable: {row['city']} is not covered by SNCS services."
        })
    else:
        # Check against Indian postal city directory
        city_data = lookup_indian_pincode_city(pin)
        if city_data:
            # Valid Indian PIN and city identified, but NOT in our serviceable network
            city_display = f"{city_data['city']}, {city_data['state']}"
            return jsonify({
                "valid": True,
                "serviceable": False,
                "status": "Unreachable",
                "pincode": pin,
                "city": city_display,
                "state": city_data["state"],
                "zone": "Unreachable",
                "cod_available": False,
                "tat_days": "N/A",
                "message": f"Unreachable: {city_data['city']} ({city_data['state']}) is not covered by our courier network."
            })
        else:
            # No city data exists / invalid PIN code
            return jsonify({
                "valid": False,
                "serviceable": False,
                "status": "Invalid",
                "pincode": pin,
                "city": "",
                "message": f"Invalid PIN code. No city data available for PIN {pin}."
            }), 400

# 3. Get All Rates
@app.route("/api/rates", methods=["GET"])
def get_rates():
    conn = get_db_connection()
    rates = conn.execute("SELECT * FROM rates ORDER BY id ASC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rates])

# 4. Check First-Time Mobile Discount
@app.route("/api/customer/check-discount", methods=["GET"])
def check_discount():
    mobile = request.args.get("mobile", "").strip()
    if not mobile or len(mobile) < 10:
        return jsonify({"first_booking_available": False, "discount": 0})

    conn = get_db_connection()
    customer = conn.execute("SELECT * FROM customers WHERE mobile = ?", (mobile,)).fetchone()
    conn.close()

    if not customer or customer["first_booking_used"] == 0:
        return jsonify({
            "first_booking_available": True,
            "discount": 50.0,
            "message": "🎉 You qualify for ₹50 First Booking Welcome Discount!"
        })
    else:
        return jsonify({
            "first_booking_available": False,
            "discount": 0.0,
            "message": "Standard SNCS Express Rate applies."
        })

# 5. Price Calculator
@app.route("/api/rates/calculate", methods=["POST"])
def calculate_rate():
    data = request.get_json() or {}
    zone_str = data.get("zone")
    destination_pin = data.get("destination_pincode", "").strip()
    actual_w = data.get("actual_weight", 0.5)
    l = data.get("length", 0)
    w = data.get("width", 0)
    h = data.get("height", 0)
    mobile = data.get("sender_mobile", "").strip()

    conn = get_db_connection()

    # Determine zone and check serviceability if destination_pin is given
    if destination_pin:
        pin_row = conn.execute("SELECT * FROM pincodes WHERE pincode = ?", (destination_pin,)).fetchone()
        if pin_row:
            if not pin_row["serviceable"]:
                conn.close()
                actual_w, vol_w, chargeable_w = calculate_chargeable_weight(actual_w, l, w, h)
                return jsonify({
                    "serviceable": False,
                    "status": "Unreachable",
                    "zone": "Unreachable",
                    "zone_name": "Unreachable Destination",
                    "delivery_days": "Service Unavailable",
                    "hub_stops": 0,
                    "actual_weight": actual_w,
                    "volumetric_weight": vol_w,
                    "chargeable_weight": chargeable_w,
                    "base_amount": 0.0,
                    "discount": 0.0,
                    "final_amount": 0.0,
                    "message": f"{pin_row['city']} is Unreachable."
                })
            zone_str = pin_row["zone"]
        else:
            # Not in DB pincodes table
            city_data = lookup_indian_pincode_city(destination_pin)
            conn.close()
            actual_w, vol_w, chargeable_w = calculate_chargeable_weight(actual_w, l, w, h)
            loc_label = f"{city_data['city']}" if city_data else f"PIN {destination_pin}"
            return jsonify({
                "serviceable": False,
                "status": "Unreachable",
                "zone": "Unreachable",
                "zone_name": "Unreachable Destination",
                "delivery_days": "Service Unavailable",
                "hub_stops": 0,
                "actual_weight": actual_w,
                "volumetric_weight": vol_w,
                "chargeable_weight": chargeable_w,
                "base_amount": 0.0,
                "discount": 0.0,
                "final_amount": 0.0,
                "message": f"{loc_label} is Unreachable. SNCS courier network does not cover this location."
            })

    if not zone_str:
        zone_str = "Zone 1"

    rate_row = conn.execute("SELECT * FROM rates WHERE zone = ?", (zone_str,)).fetchone()
    if not rate_row:
        rate_row = conn.execute("SELECT * FROM rates WHERE id = 1").fetchone()

    actual_w, vol_w, chargeable_w = calculate_chargeable_weight(actual_w, l, w, h)

    # Base price for first 1 kg
    first_kg_price = float(rate_row["first_kg_price"])
    extra_kg_price = float(rate_row["extra_kg_price"])

    if chargeable_w <= 1.0:
        base_amount = first_kg_price
    else:
        extra_units = math.ceil(chargeable_w - 1.0)
        base_amount = first_kg_price + (extra_units * extra_kg_price)

    # Check discount
    discount = 0.0
    if mobile and len(mobile) >= 10:
        cust = conn.execute("SELECT * FROM customers WHERE mobile = ?", (mobile,)).fetchone()
        if not cust or cust["first_booking_used"] == 0:
            discount = 50.0

    final_amount = max(20.0, round(base_amount - discount, 2))
    conn.close()

    return jsonify({
        "serviceable": True,
        "status": "Serviceable",
        "zone": rate_row["zone"],
        "zone_name": rate_row["zone_name"],
        "delivery_days": rate_row["delivery_days"],
        "hub_stops": rate_row["hub_stops"],
        "actual_weight": actual_w,
        "volumetric_weight": vol_w,
        "chargeable_weight": chargeable_w,
        "base_amount": round(base_amount, 2),
        "discount": discount,
        "final_amount": final_amount
    })

# 6. Book Parcel
@app.route("/api/bookings", methods=["POST"])
def create_booking():
    data = request.get_json() or {}
    sender_name = data.get("sender_name", "").strip()
    sender_mobile = data.get("sender_mobile", "").strip()
    sender_email = data.get("sender_email", "").strip()
    sender_address = data.get("sender_address", "").strip()
    sender_pincode = data.get("sender_pincode", "834001").strip()
    sender_city = data.get("sender_city", "Ranchi").strip()

    receiver_name = data.get("receiver_name", "").strip()
    receiver_mobile = data.get("receiver_mobile", "").strip()
    receiver_address = data.get("receiver_address", "").strip()
    receiver_pincode = data.get("receiver_pincode", "").strip()
    receiver_city = data.get("receiver_city", "").strip()

    package_type = data.get("package_type", "Standard Parcel")
    payment_method = data.get("payment_method", "Cash at Pickup")

    if not sender_name or not sender_mobile or not receiver_name or not receiver_pincode or not receiver_address:
        return jsonify({"success": False, "message": "Required fields missing."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Determine Zone and Validate Serviceability
    pin_row = cursor.execute("SELECT * FROM pincodes WHERE pincode = ?", (receiver_pincode,)).fetchone()
    if not pin_row or not pin_row["serviceable"]:
        city_info = lookup_indian_pincode_city(receiver_pincode)
        loc_name = pin_row["city"] if pin_row else (f"{city_info['city']}" if city_info else f"PIN {receiver_pincode}")
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Booking failed: Destination location '{loc_name}' (PIN: {receiver_pincode}) is Unreachable. Bookings are not allowed for unreachable locations."
        }), 400

    zone = pin_row["zone"]
    tat = pin_row["tat_days"]
    if not receiver_city:
        receiver_city = pin_row["city"]

    rate_row = cursor.execute("SELECT * FROM rates WHERE zone = ?", (zone,)).fetchone()
    actual_w, vol_w, ch_w = calculate_chargeable_weight(
        data.get("actual_weight", 1.0),
        data.get("length", 0),
        data.get("width", 0),
        data.get("height", 0)
    )

    first_kg_price = float(rate_row["first_kg_price"]) if rate_row else 40.0
    extra_kg_price = float(rate_row["extra_kg_price"]) if rate_row else 20.0
    stoppages = int(rate_row["hub_stops"]) if rate_row else 1

    if ch_w <= 1.0:
        base_amount = first_kg_price
    else:
        base_amount = first_kg_price + (math.ceil(ch_w - 1.0) * extra_kg_price)

    # Check first-booking discount
    discount = 0.0
    cust = cursor.execute("SELECT * FROM customers WHERE mobile = ?", (sender_mobile,)).fetchone()
    if not cust:
        cursor.execute("""
        INSERT INTO customers (name, mobile, email, first_booking_used)
        VALUES (?, ?, ?, 1)
        """, (sender_name, sender_mobile, sender_email))
        discount = 50.0
    elif cust["first_booking_used"] == 0:
        cursor.execute("UPDATE customers SET first_booking_used = 1 WHERE mobile = ?", (sender_mobile,))
        discount = 50.0

    final_amount = max(20.0, round(base_amount - discount, 2))
    tracking_id = generate_tracking_id(cursor)

    # Expected delivery date calculation
    days_add = 1
    if "2" in tat:
        days_add = 2
    elif "3" in tat or "4" in tat:
        days_add = 3
    elif "6" in tat:
        days_add = 5
    exp_date = (datetime.now() + timedelta(days=days_add)).strftime("%d %b %Y")

    payment_status = "Paid" if payment_method.startswith("Online") else "Cash at Pickup"

    cursor.execute("""
    INSERT INTO bookings (
        tracking_id, sender_name, sender_mobile, sender_email, sender_address, sender_pincode, sender_city,
        receiver_name, receiver_mobile, receiver_address, receiver_pincode, receiver_city,
        package_type, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
        zone, base_amount, discount, amount, payment_method, payment_status, current_status, current_hub,
        stoppages, expected_delivery_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        tracking_id, sender_name, sender_mobile, sender_email, sender_address, sender_pincode, sender_city,
        receiver_name, receiver_mobile, receiver_address, receiver_pincode, receiver_city,
        package_type, actual_w, float(data.get("length", 0)), float(data.get("width", 0)), float(data.get("height", 0)),
        vol_w, ch_w, zone, base_amount, discount, final_amount, payment_method, payment_status,
        'Booking Confirmed', 'Ranchi Overbridge Hub', stoppages, exp_date
    ))

    # Add initial event
    cursor.execute("""
    INSERT INTO parcel_events (tracking_id, hub_name, status, remarks)
    VALUES (?, ?, ?, ?)
    """, (
        tracking_id,
        'Ranchi Overbridge Central Hub',
        'Booking Confirmed',
        f'Parcel registered for express pickup at {sender_address}, Ranchi. Payment mode: {payment_method}.'
    ))

    conn.commit()
    conn.close()

    # --- REAL-TIME PUSH: Notify Admin Dashboard ---
    created_at_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    event_bus.publish("admin", {
        "type": "new_booking",
        "booking": {
            "tracking_id": tracking_id,
            "sender_name": sender_name,
            "sender_mobile": sender_mobile,
            "sender_city": sender_city,
            "receiver_name": receiver_name,
            "receiver_city": receiver_city,
            "receiver_pincode": receiver_pincode,
            "chargeable_weight": ch_w,
            "amount": final_amount,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "current_status": "Booking Confirmed",
            "current_hub": "Ranchi Overbridge Hub",
            "created_at": created_at_now
        }
    })

    return jsonify({
        "success": True,
        "tracking_id": tracking_id,
        "amount": final_amount,
        "discount_applied": discount,
        "expected_delivery_date": exp_date,
        "message": f"Parcel successfully booked! Your tracking ID is {tracking_id}."
    })

# 7. Track Parcel
@app.route("/api/track/<tracking_id>", methods=["GET"])
def track_parcel(tracking_id):
    clean_id = tracking_id.strip().upper()
    conn = get_db_connection()
    booking = conn.execute("SELECT * FROM bookings WHERE UPPER(tracking_id) = ?", (clean_id,)).fetchone()
    if not booking:
        conn.close()
        return jsonify({"found": False, "message": f"Tracking ID '{clean_id}' not found in SNCS system."}), 404

    events = conn.execute("""
    SELECT hub_name, status, remarks, timestamp
    FROM parcel_events
    WHERE UPPER(tracking_id) = ?
    ORDER BY id ASC
    """, (clean_id,)).fetchall()

    conn.close()

    return jsonify({
        "found": True,
        "tracking_id": booking["tracking_id"],
        "sender_name": booking["sender_name"],
        "sender_city": booking["sender_city"],
        "receiver_name": booking["receiver_name"],
        "receiver_city": booking["receiver_city"],
        "receiver_pincode": booking["receiver_pincode"],
        "package_type": booking["package_type"],
        "chargeable_weight": booking["chargeable_weight"],
        "current_status": booking["current_status"],
        "current_hub": booking["current_hub"],
        "stoppages": booking["stoppages"],
        "expected_delivery_date": booking["expected_delivery_date"],
        "created_at": booking["created_at"],
        "payment_status": booking["payment_status"],
        "events": [dict(e) for e in events]
    })

# 8. Razorpay / Payment Simulation
@app.route("/api/payments/verify", methods=["POST"])
def verify_payment():
    data = request.get_json() or {}
    tracking_id = data.get("tracking_id")
    if tracking_id:
        conn = get_db_connection()
        conn.execute("UPDATE bookings SET payment_status = 'Paid' WHERE tracking_id = ?", (tracking_id,))
        conn.commit()
        conn.close()
    return jsonify({
        "status": "success",
        "payment_id": f"pay_sncs_{int(datetime.now().timestamp())}",
        "message": "Payment verified successfully!"
    })

# --- ADMIN APIS ---

# Admin Login
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM admin_users WHERE username = ?", (username,)).fetchone()
    conn.close()

    if user and user["password_hash"] == hash_password(password):
        session["admin_logged_in"] = True
        session["admin_user"] = username
        session["admin_role"] = user["role"]
        return jsonify({
            "success": True,
            "username": username,
            "role": user["role"],
            "message": "Login successful"
        })
    return jsonify({"success": False, "message": "Invalid username or password"}), 401

@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.clear()
    return jsonify({"success": True})

# Admin Dashboard Stats
@app.route("/api/admin/dashboard", methods=["GET"])
def admin_dashboard():
    conn = get_db_connection()
    total_bookings = conn.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
    in_transit = conn.execute("SELECT COUNT(*) FROM bookings WHERE current_status IN ('Picked Up', 'In Transit', 'Dispatched')").fetchone()[0]
    out_for_delivery = conn.execute("SELECT COUNT(*) FROM bookings WHERE current_status = 'Out for Delivery'").fetchone()[0]
    delivered = conn.execute("SELECT COUNT(*) FROM bookings WHERE current_status = 'Delivered'").fetchone()[0]
    pending_pickups = conn.execute("SELECT COUNT(*) FROM bookings WHERE current_status = 'Booking Confirmed'").fetchone()[0]
    total_revenue = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM bookings").fetchone()[0]

    recent_bookings = conn.execute("""
    SELECT tracking_id, sender_name, receiver_name, receiver_city, amount, current_status, created_at
    FROM bookings ORDER BY id DESC LIMIT 5
    """).fetchall()

    conn.close()

    return jsonify({
        "total_bookings": total_bookings,
        "in_transit": in_transit,
        "out_for_delivery": out_for_delivery,
        "delivered": delivered,
        "pending_pickups": pending_pickups,
        "total_revenue": round(total_revenue, 2),
        "recent_bookings": [dict(r) for r in recent_bookings]
    })

# Admin Bookings List
@app.route("/api/admin/bookings", methods=["GET"])
def admin_bookings():
    status_filter = request.args.get("status", "").strip()
    query = request.args.get("q", "").strip()

    sql = "SELECT * FROM bookings WHERE 1=1"
    params = []

    if status_filter:
        sql += " AND current_status = ?"
        params.append(status_filter)

    if query:
        sql += " AND (tracking_id LIKE ? OR sender_name LIKE ? OR sender_mobile LIKE ? OR receiver_name LIKE ? OR receiver_city LIKE ?)"
        term = f"%{query}%"
        params.extend([term, term, term, term, term])

    sql += " ORDER BY id DESC"

    conn = get_db_connection()
    rows = conn.execute(sql, params).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])

# Admin Update Parcel Hub / Status
@app.route("/api/admin/bookings/<tracking_id>/status", methods=["POST"])
def admin_update_status(tracking_id):
    data = request.get_json() or {}
    new_status = data.get("status")
    hub_name = data.get("hub_name", "Ranchi Overbridge Hub")
    remarks = data.get("remarks", "")

    if not new_status:
        return jsonify({"success": False, "message": "New status is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    booking = cursor.execute("SELECT * FROM bookings WHERE tracking_id = ?", (tracking_id,)).fetchone()
    if not booking:
        conn.close()
        return jsonify({"success": False, "message": "Booking not found"}), 404

    # Update booking
    cursor.execute("""
    UPDATE bookings
    SET current_status = ?, current_hub = ?, updated_at = CURRENT_TIMESTAMP
    WHERE tracking_id = ?
    """, (new_status, hub_name, tracking_id))

    # Add parcel event
    event_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO parcel_events (tracking_id, hub_name, status, remarks)
    VALUES (?, ?, ?, ?)
    """, (tracking_id, hub_name, new_status, remarks or f"Status updated to {new_status} at {hub_name}."))

    conn.commit()
    conn.close()

    # --- REAL-TIME PUSH: Broadcast to Customer Tracking & Admin Feed ---
    payload = {
        "tracking_id": tracking_id,
        "current_status": new_status,
        "current_hub": hub_name,
        "remarks": remarks or f"Status updated to {new_status} at {hub_name}.",
        "timestamp": event_timestamp
    }
    # 1. Customer live tracking stream
    event_bus.publish(f"track:{tracking_id.upper()}", {
        "type": "status_update",
        **payload
    })
    # 2. Admin operations stream
    event_bus.publish("admin", {
        "type": "status_update",
        **payload
    })

    return jsonify({
        "success": True,
        "message": f"Status updated to '{new_status}' successfully."
    })

# Admin Edit Rates
@app.route("/api/admin/rates/<int:rate_id>", methods=["PUT"])
def admin_update_rate(rate_id):
    data = request.get_json() or {}
    first_kg = data.get("first_kg_price")
    extra_kg = data.get("extra_kg_price")
    delivery_days = data.get("delivery_days")

    conn = get_db_connection()
    conn.execute("""
    UPDATE rates
    SET first_kg_price = ?, extra_kg_price = ?, delivery_days = ?
    WHERE id = ?
    """, (float(first_kg), float(extra_kg), delivery_days, rate_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Rates updated successfully."})

# Admin Pincodes Management
@app.route("/api/admin/pincodes", methods=["GET", "POST"])
def admin_pincodes():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        pincode = data.get("pincode")
        city = data.get("city")
        state = data.get("state")
        zone = data.get("zone")
        tat = data.get("tat_days", "2-3 Days")
        serviceable = 1 if data.get("serviceable", True) else 0

        conn.execute("""
        INSERT OR REPLACE INTO pincodes (pincode, city, state, zone, serviceable, tat_days)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (pincode, city, state, zone, serviceable, tat))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Pincode saved."})

    rows = conn.execute("SELECT * FROM pincodes ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# Admin Offers Management
@app.route("/api/admin/offers", methods=["GET", "PUT"])
def admin_offers():
    conn = get_db_connection()
    if request.method == "PUT":
        data = request.get_json() or {}
        text = data.get("text", "")
        discount = data.get("discount_amount", 50.0)
        is_active = 1 if data.get("is_active") else 0

        conn.execute("""
        UPDATE offers
        SET text = ?, discount_amount = ?, is_active = ?
        WHERE id = 1
        """, (text, float(discount), is_active))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Offer updated."})

    offer = conn.execute("SELECT * FROM offers WHERE id = 1").fetchone()
    conn.close()
    return jsonify(dict(offer) if offer else {})

# Daily CSV Report Export
@app.route("/api/admin/export-csv")
def export_csv():
    conn = get_db_connection()
    rows = conn.execute("""
    SELECT tracking_id, sender_name, sender_mobile, sender_city,
           receiver_name, receiver_mobile, receiver_city, receiver_pincode,
           chargeable_weight, zone, amount, payment_method, payment_status, current_status, created_at
    FROM bookings ORDER BY id DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Tracking ID", "Sender", "Sender Phone", "Origin City",
        "Receiver", "Receiver Phone", "Destination City", "Destination PIN",
        "Chargeable Weight (kg)", "Zone", "Amount (INR)", "Payment Method", "Payment Status", "Status", "Date"
    ])

    for r in rows:
        writer.writerow([
            r["tracking_id"], r["sender_name"], r["sender_mobile"], r["sender_city"],
            r["receiver_name"], r["receiver_mobile"], r["receiver_city"], r["receiver_pincode"],
            r["chargeable_weight"], r["zone"], r["amount"], r["payment_method"], r["payment_status"], r["current_status"], r["created_at"]
        ])

    today_str = datetime.now().strftime("%Y-%m-%d")
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=SNCS_Courier_Report_{today_str}.csv"}
    )

# ==========================================================
# --- REAL-TIME SSE STREAMING APIS ---
# ==========================================================

# 1. Real-time stream for customer tracking a specific consignment
@app.route("/api/stream/track/<tracking_id>")
def stream_track_events(tracking_id):
    clean_id = tracking_id.strip().upper()

    def event_stream():
        q = event_bus.subscribe(f"track:{clean_id}")
        # Send initial connected event
        yield f"event: connected\ndata: {json.dumps({'tracking_id': clean_id, 'status': 'connected', 'server_time': datetime.now().isoformat()})}\n\n"
        try:
            while True:
                try:
                    data = q.get(timeout=20)
                    yield f"event: update\ndata: {json.dumps(data)}\n\n"
                except queue.Empty:
                    # Keep-alive heartbeat comment
                    yield f": heartbeat {int(time.time())}\n\n"
        except GeneratorExit:
            pass
        finally:
            event_bus.unsubscribe(f"track:{clean_id}", q)

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )

# 2. Real-time stream for Admin Dashboard (Bookings & Status updates)
@app.route("/api/stream/admin")
def stream_admin_events():
    def event_stream():
        q = event_bus.subscribe("admin")
        yield f"event: connected\ndata: {json.dumps({'channel': 'admin', 'status': 'connected', 'server_time': datetime.now().isoformat()})}\n\n"
        try:
            while True:
                try:
                    data = q.get(timeout=20)
                    event_type = data.get("type", "message")
                    yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
                except queue.Empty:
                    yield f": heartbeat {int(time.time())}\n\n"
        except GeneratorExit:
            pass
        finally:
            event_bus.unsubscribe("admin", q)

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )

# 3. Live Transit Simulator (Automated Real-time Demo Runner)
@app.route("/api/admin/simulate-transit", methods=["POST"])
def simulate_transit():
    data = request.get_json() or {}
    tracking_id = data.get("tracking_id", "SNCS1024").strip().upper()
    speed = float(data.get("speed_seconds", 5.0))
    speed = max(2.0, min(30.0, speed))  # Bound between 2s and 30s

    conn = get_db_connection()
    booking = conn.execute("SELECT * FROM bookings WHERE UPPER(tracking_id) = ?", (tracking_id,)).fetchone()
    conn.close()

    if not booking:
        return jsonify({"success": False, "message": f"Consignment {tracking_id} not found."}), 404

    if active_simulations.get(tracking_id):
        return jsonify({"success": False, "message": f"Simulation already active for {tracking_id}."}), 400

    def run_simulation(tid, interval):
        active_simulations[tid] = True
        try:
            steps = [
                ("Booking Confirmed", "Ranchi Online Portal", f"Consignment booked and scheduled for doorstep pickup in Ranchi."),
                ("Picked Up", "Ranchi Overbridge Central Hub", f"Collected by field rider and weighed at Gandhi Market hub."),
                ("Dispatched", "Ranchi Airport Express Cargo", f"Bag sealed and dispatched on priority express line."),
                ("In Transit", f"{booking['receiver_city']} Regional Hub", f"Arrived at destination gateway. Scanned and sorted for final delivery unit."),
                ("Out for Delivery", f"{booking['receiver_city']} Delivery Depot", f"Handed to courier agent Vikash (OTP confirmation enabled). Out for delivery."),
                ("Delivered", f"{booking['receiver_city']} Destination", f"Delivered safely to {booking['receiver_name']}. Digital signature and OTP verified.")
            ]

            for status, hub, remark in steps:
                time.sleep(interval)
                # Update DB
                c = get_db_connection()
                cur = c.cursor()
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cur.execute("""
                UPDATE bookings
                SET current_status = ?, current_hub = ?, updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(tracking_id) = ?
                """, (status, hub, tid))

                cur.execute("""
                INSERT INTO parcel_events (tracking_id, hub_name, status, remarks, timestamp)
                VALUES (?, ?, ?, ?, ?)
                """, (tid, hub, status, remark, now_str))
                c.commit()
                c.close()

                # Broadcast live real-time events
                event_data = {
                    "tracking_id": tid,
                    "current_status": status,
                    "current_hub": hub,
                    "remarks": remark,
                    "timestamp": now_str,
                    "simulation": True
                }
                event_bus.publish(f"track:{tid}", {"type": "status_update", **event_data})
                event_bus.publish("admin", {"type": "status_update", **event_data})
        finally:
            active_simulations.pop(tid, None)

    thread = threading.Thread(target=run_simulation, args=(tracking_id, speed), daemon=True)
    thread.start()

    return jsonify({
        "success": True,
        "message": f"Real-time transit simulation started for {tracking_id}! Watching updates every {speed}s.",
        "tracking_id": tracking_id,
        "speed_seconds": speed
    })

@app.route("/api/admin/simulation-status", methods=["GET"])
def simulation_status():
    return jsonify({
        "active_simulations": list(active_simulations.keys())
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5005))
    print(f"🚀 Shri Network Courier Services (SNCS) running at: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
