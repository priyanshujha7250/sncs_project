import sqlite3
import os
import shutil
import hashlib
from datetime import datetime, timedelta

def get_db_path():
    if os.environ.get("VERCEL"):
        tmp_path = "/tmp/sncs.db"
        orig_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sncs.db")
        if not os.path.exists(tmp_path) and os.path.exists(orig_path):
            try:
                shutil.copy2(orig_path, tmp_path)
            except Exception:
                pass
        return tmp_path
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "sncs.db")

DB_PATH = get_db_path()

def get_db_connection():
    db_file = get_db_path()
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Customers Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        mobile TEXT UNIQUE NOT NULL,
        email TEXT,
        first_booking_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Bookings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_id TEXT UNIQUE NOT NULL,
        sender_name TEXT NOT NULL,
        sender_mobile TEXT NOT NULL,
        sender_email TEXT,
        sender_address TEXT NOT NULL,
        sender_pincode TEXT NOT NULL,
        sender_city TEXT NOT NULL,
        receiver_name TEXT NOT NULL,
        receiver_mobile TEXT NOT NULL,
        receiver_address TEXT NOT NULL,
        receiver_pincode TEXT NOT NULL,
        receiver_city TEXT NOT NULL,
        package_type TEXT DEFAULT 'Parcel',
        actual_weight REAL NOT NULL,
        length REAL DEFAULT 0,
        width REAL DEFAULT 0,
        height REAL DEFAULT 0,
        volumetric_weight REAL DEFAULT 0,
        chargeable_weight REAL NOT NULL,
        zone TEXT NOT NULL,
        base_amount REAL NOT NULL,
        discount REAL DEFAULT 0,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'Cash at Pickup',
        payment_status TEXT DEFAULT 'Pending',
        current_status TEXT DEFAULT 'Booking Confirmed',
        current_hub TEXT DEFAULT 'Ranchi Overbridge Hub',
        stoppages INTEGER DEFAULT 1,
        expected_delivery_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Parcel Events Table (Timeline)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS parcel_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_id TEXT NOT NULL,
        hub_name TEXT NOT NULL,
        status TEXT NOT NULL,
        remarks TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tracking_id) REFERENCES bookings(tracking_id)
    );
    """)

    # 4. Rates Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone TEXT UNIQUE NOT NULL,
        zone_name TEXT NOT NULL,
        first_kg_price REAL NOT NULL,
        extra_kg_price REAL NOT NULL,
        delivery_days TEXT NOT NULL,
        hub_stops INTEGER NOT NULL
    );
    """)

    # 5. Pincodes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pincodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pincode TEXT UNIQUE NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zone TEXT NOT NULL,
        serviceable INTEGER DEFAULT 1,
        cod_available INTEGER DEFAULT 1,
        tat_days TEXT NOT NULL
    );
    """)

    # 6. Offers Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        hindi_text TEXT,
        code TEXT DEFAULT 'FIRST50',
        discount_amount REAL DEFAULT 50.0,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1
    );
    """)

    # Safe migration for existing installations
    for migration_sql in [
        "ALTER TABLE offers ADD COLUMN code TEXT DEFAULT 'FIRST50'",
        "ALTER TABLE offers ADD COLUMN hindi_text TEXT DEFAULT 'पहली बुकिंग पर ₹50 की छूट · कोड: FIRST50'",
        "ALTER TABLE bookings ADD COLUMN promo_code TEXT"
    ]:
        try:
            cursor.execute(migration_sql)
        except Exception:
            pass

    # 7. Admin Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'staff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def seed_initial_data(conn):
    cursor = conn.cursor()

    # Seed Admin User if none exists
    cursor.execute("SELECT COUNT(*) FROM admin_users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO admin_users (username, password_hash, role)
        VALUES (?, ?, ?)
        """, ('admin', hash_password('admin123'), 'owner'))
        cursor.execute("""
        INSERT INTO admin_users (username, password_hash, role)
        VALUES (?, ?, ?)
        """, ('staff', hash_password('sncs834001'), 'staff'))

    # Seed Rates
    cursor.execute("SELECT COUNT(*) FROM rates")
    if cursor.fetchone()[0] == 0:
        rates_data = [
            ('Zone 1', 'Ranchi Local', 40.0, 20.0, 'Same Day / 24 Hours', 1),
            ('Zone 2', 'Jharkhand State', 60.0, 35.0, '1 - 2 Days', 2),
            ('Zone 3', 'Metro Cities (Kolkata, Delhi, Mumbai, Bengaluru, Patna)', 110.0, 60.0, '2 - 4 Days', 3),
            ('Zone 4', 'Rest of India', 150.0, 80.0, '3 - 6 Days', 4)
        ]
        cursor.executemany("""
        INSERT INTO rates (zone, zone_name, first_kg_price, extra_kg_price, delivery_days, hub_stops)
        VALUES (?, ?, ?, ?, ?, ?)
        """, rates_data)

    # Seed Pincodes
    cursor.execute("SELECT COUNT(*) FROM pincodes")
    if cursor.fetchone()[0] == 0:
        pincodes_data = [
            # Ranchi Local (Zone 1)
            ('834001', 'Ranchi (Gandhi Market / Overbridge / Main Road)', 'Jharkhand', 'Zone 1', 1, 1, 'Same Day (Within 12h)'),
            ('834002', 'Ranchi (Doranda / Hinoo)', 'Jharkhand', 'Zone 1', 1, 1, 'Same Day (Within 12h)'),
            ('834004', 'Ranchi (Harmu / Ashok Nagar)', 'Jharkhand', 'Zone 1', 1, 1, 'Same Day (Within 12h)'),
            ('834005', 'Ranchi (Kanke / Morabadi)', 'Jharkhand', 'Zone 1', 1, 1, 'Next Day'),
            ('834009', 'Ranchi (Bariatu / Kokar)', 'Jharkhand', 'Zone 1', 1, 1, 'Same Day (Within 12h)'),
            ('834010', 'Ranchi (Tupudana / Hatia)', 'Jharkhand', 'Zone 1', 1, 1, 'Next Day'),
            ('835217', 'Ranchi (Namkum / Tatisilwai)', 'Jharkhand', 'Zone 1', 1, 1, 'Next Day'),
            # Jharkhand State (Zone 2)
            ('831001', 'Jamshedpur (Bistupur / Sakchi)', 'Jharkhand', 'Zone 2', 1, 1, '1 - 2 Days'),
            ('826001', 'Dhanbad (Bank More / Station)', 'Jharkhand', 'Zone 2', 1, 1, '1 - 2 Days'),
            ('827001', 'Bokaro Steel City', 'Jharkhand', 'Zone 2', 1, 1, '1 - 2 Days'),
            ('814112', 'Deoghar', 'Jharkhand', 'Zone 2', 1, 1, '2 Days'),
            ('825301', 'Hazaribagh', 'Jharkhand', 'Zone 2', 1, 1, '1 - 2 Days'),
            ('822101', 'Daltonganj / Medininagar', 'Jharkhand', 'Zone 2', 1, 1, '2 Days'),
            ('832107', 'Ghatshila', 'Jharkhand', 'Zone 2', 1, 1, '2 Days'),
            # Metro Cities (Zone 3)
            ('700001', 'Kolkata (BBD Bagh / Central)', 'West Bengal', 'Zone 3', 1, 1, '2 - 3 Days'),
            ('800001', 'Patna (GPO / Frazer Road)', 'Bihar', 'Zone 3', 1, 1, '2 Days'),
            ('110001', 'New Delhi (Connaught Place)', 'Delhi', 'Zone 3', 1, 1, '2 - 3 Days'),
            ('400001', 'Mumbai (Fort / South Mumbai)', 'Maharashtra', 'Zone 3', 1, 1, '3 - 4 Days'),
            ('560001', 'Bengaluru (MG Road / City)', 'Karnataka', 'Zone 3', 1, 1, '3 - 4 Days'),
            ('500001', 'Hyderabad (Abids / GPO)', 'Telangana', 'Zone 3', 1, 1, '3 - 4 Days'),
            # Rest of India (Zone 4)
            ('600001', 'Chennai (George Town)', 'Tamil Nadu', 'Zone 4', 1, 1, '4 - 5 Days'),
            ('380001', 'Ahmedabad', 'Gujarat', 'Zone 4', 1, 1, '3 - 5 Days'),
            ('781001', 'Guwahati', 'Assam', 'Zone 4', 1, 1, '4 - 6 Days'),
            ('302001', 'Jaipur', 'Rajasthan', 'Zone 4', 1, 1, '3 - 5 Days'),
            ('160017', 'Chandigarh', 'Punjab / Haryana', 'Zone 4', 1, 1, '3 - 4 Days'),
            ('682001', 'Kochi', 'Kerala', 'Zone 4', 1, 1, '4 - 6 Days')
        ]
        cursor.executemany("""
        INSERT INTO pincodes (pincode, city, state, zone, serviceable, cod_available, tat_days)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, pincodes_data)

    # Seed Festive Offer
    cursor.execute("SELECT COUNT(*) FROM offers")
    if cursor.fetchone()[0] == 0:
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        cursor.execute("""
        INSERT INTO offers (title, text, hindi_text, code, discount_amount, start_date, end_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'Welcome Offer 🎁',
            'First booking par ₹50 OFF · Code: FIRST50',
            'पहली बुकिंग पर ₹50 की छूट · कोड: FIRST50',
            'FIRST50',
            50.0,
            today,
            next_month,
            1
        ))
    else:
        # Update existing offer to the new clean default text & code if needed
        cursor.execute("""
        UPDATE offers
        SET text = COALESCE(NULLIF(text, ''), 'First booking par ₹50 OFF · Code: FIRST50'),
            hindi_text = COALESCE(NULLIF(hindi_text, ''), 'पहली बुकिंग पर ₹50 की छूट · कोड: FIRST50'),
            code = COALESCE(NULLIF(code, ''), 'FIRST50'),
            discount_amount = 50.0
        WHERE id = 1
        """)

    # Seed Initial Customers and Sample Bookings with Realistic Timelines
    cursor.execute("SELECT COUNT(*) FROM bookings")
    if cursor.fetchone()[0] == 0:
        # Seed Customer
        cursor.execute("""
        INSERT OR IGNORE INTO customers (name, mobile, email, first_booking_used)
        VALUES (?, ?, ?, ?)
        """, ('Amitabh Verma', '9835123456', 'amitabh.verma@example.com', 1))

        cursor.execute("""
        INSERT OR IGNORE INTO customers (name, mobile, email, first_booking_used)
        VALUES (?, ?, ?, ?)
        """, ('Sunita Devi', '9431187654', 'sunita.d@example.com', 1))

        # 1. Booking SNCS1024 - In Transit
        exp_date_1 = (datetime.now() + timedelta(days=2)).strftime("%d %b %Y")
        cursor.execute("""
        INSERT INTO bookings (
            tracking_id, sender_name, sender_mobile, sender_email, sender_address, sender_pincode, sender_city,
            receiver_name, receiver_mobile, receiver_address, receiver_pincode, receiver_city,
            package_type, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
            zone, base_amount, discount, amount, payment_method, payment_status, current_status, current_hub,
            stoppages, expected_delivery_date
        ) VALUES (
            'SNCS1024', 'Amitabh Verma', '9835123456', 'amitabh.verma@example.com', 'Flat 302, Green Valley Apt, Bariatu', '834009', 'Ranchi',
            'Rajesh Sen', '9830054321', '14/B Park Street, Flat 4', '700001', 'Kolkata',
            'Documents & Samples', 1.8, 30, 20, 10, 1.2, 1.8,
            'Zone 3', 170.0, 50.0, 120.0, 'Online (UPI/Razorpay)', 'Paid', 'In Transit', 'Kolkata Central Hub',
            3, ?
        )
        """, (exp_date_1,))

        # Events for SNCS1024
        t_now = datetime.now()
        t1 = (t_now - timedelta(days=1, hours=6)).strftime("%Y-%m-%d %H:%M:%S")
        t2 = (t_now - timedelta(days=1, hours=2)).strftime("%Y-%m-%d %H:%M:%S")
        t3 = (t_now - timedelta(hours=14)).strftime("%Y-%m-%d %H:%M:%S")
        t4 = (t_now - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")

        cursor.executemany("""
        INSERT INTO parcel_events (tracking_id, hub_name, status, remarks, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """, [
            ('SNCS1024', 'Ranchi Online Portal', 'Booking Confirmed', 'Parcel registered. Pickup scheduled from Bariatu, Ranchi.', t1),
            ('SNCS1024', 'Ranchi Overbridge Central Hub', 'Picked Up', 'Collected by executive and arrived at Gandhi Market main sorting facility.', t2),
            ('SNCS1024', 'Ranchi Airport Cargo Hub', 'Dispatched', 'Handed over to express surface/air transit towards Kolkata.', t3),
            ('SNCS1024', 'Kolkata Central Sorting Hub', 'In Transit', 'Received at Kolkata hub. Bag opened and sorted for destination delivery center.', t4)
        ])

        # 2. Booking SNCS1025 - Delivered
        exp_date_2 = datetime.now().strftime("%d %b %Y")
        cursor.execute("""
        INSERT INTO bookings (
            tracking_id, sender_name, sender_mobile, sender_email, sender_address, sender_pincode, sender_city,
            receiver_name, receiver_mobile, receiver_address, receiver_pincode, receiver_city,
            package_type, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
            zone, base_amount, discount, amount, payment_method, payment_status, current_status, current_hub,
            stoppages, expected_delivery_date
        ) VALUES (
            'SNCS1025', 'Sunita Devi', '9431187654', 'sunita.d@example.com', 'Shop 12, Main Road', '834001', 'Ranchi',
            'Manish Kumar', '8210943210', 'Plot 45, Harmu Housing Colony', '834004', 'Ranchi',
            'Textile & Clothes', 2.0, 25, 20, 15, 1.5, 2.0,
            'Zone 1', 60.0, 0.0, 60.0, 'Cash at Pickup', 'Paid', 'Delivered', 'Harmu Delivery Point',
            1, ?
        )
        """, (exp_date_2,))

        cursor.executemany("""
        INSERT INTO parcel_events (tracking_id, hub_name, status, remarks, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """, [
            ('SNCS1025', 'Ranchi Gandhi Market Counter', 'Booking Confirmed', 'Consignment booked directly at office counter.', (t_now - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S")),
            ('SNCS1025', 'Ranchi Overbridge Central Hub', 'Picked Up', 'Verified weight and sealed for local delivery.', (t_now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S")),
            ('SNCS1025', 'Harmu Dispatch Center', 'Out for Delivery', 'Rider Vikash (Mob: 9334812345) out for doorstep delivery.', (t_now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")),
            ('SNCS1025', 'Harmu Destination', 'Delivered', 'Successfully delivered to Manish Kumar. Signed with OTP confirmation.', (t_now - timedelta(minutes=40)).strftime("%Y-%m-%d %H:%M:%S"))
        ])

        # 3. Booking SNCS1026 - Out for Delivery in Jamshedpur
        exp_date_3 = datetime.now().strftime("%d %b %Y")
        cursor.execute("""
        INSERT INTO bookings (
            tracking_id, sender_name, sender_mobile, sender_email, sender_address, sender_pincode, sender_city,
            receiver_name, receiver_mobile, receiver_address, receiver_pincode, receiver_city,
            package_type, actual_weight, length, width, height, volumetric_weight, chargeable_weight,
            zone, base_amount, discount, amount, payment_method, payment_status, current_status, current_hub,
            stoppages, expected_delivery_date
        ) VALUES (
            'SNCS1026', 'Ramesh Agarwal', '7004123890', 'agarwal.ranchi@gmail.com', 'Basera Hotel Chowk, Gandhi Market', '834001', 'Ranchi',
            'Deepak Sharma', '9123456780', 'Bistupur Market Road', '831001', 'Jamshedpur',
            'Hardware Tools', 3.5, 30, 25, 20, 3.0, 3.5,
            'Zone 2', 147.5, 50.0, 97.5, 'Online (UPI/Razorpay)', 'Paid', 'Out for Delivery', 'Jamshedpur Bistupur Hub',
            2, ?
        )
        """, (exp_date_3,))

        cursor.executemany("""
        INSERT INTO parcel_events (tracking_id, hub_name, status, remarks, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """, [
            ('SNCS1026', 'Ranchi Gandhi Market Counter', 'Booking Confirmed', 'Parcel booked with priority express surface.', (t_now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")),
            ('SNCS1026', 'Ranchi Overbridge Central Hub', 'Picked Up', 'Packed and loaded into Jamshedpur express van.', (t_now - timedelta(hours=20)).strftime("%Y-%m-%d %H:%M:%S")),
            ('SNCS1026', 'Jamshedpur Sorting Hub', 'In Transit', 'Arrived at Jamshedpur depot at 6:30 AM.', (t_now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S")),
            ('SNCS1026', 'Jamshedpur Bistupur Delivery Center', 'Out for Delivery', 'Out with delivery agent Rakesh for delivery before 4 PM.', (t_now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"))
        ])

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("SNCS SQLite Database initialized successfully with all tables and seed data!")
