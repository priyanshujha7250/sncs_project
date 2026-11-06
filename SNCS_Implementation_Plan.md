# SNCS Website: Poora Implementation Plan
**Shri Network Courier Services (SNCS)**, Gandhi Market, near Basera Hotel overbridge, Ranchi, Jharkhand 834001
Contact: 7479814001, 6291414573 | priyanshujha@gmail.com | Time: 9 am to 10 pm

---

## 1. Kya banega (scope)
- **Customer side:** Home, Book & Pay, Track, Price, Pin code check, Contact
- **Owner side:** Admin panel, jahan se parcel status, rates, pin codes aur festive offers update honge
- **Backend:** Database, payment gateway, SMS/email

## 2. Tech stack (simple aur sasta)

| Part | Suggestion | Kyun |
|---|---|---|
| Frontend | React (Next.js) ya plain HTML/CSS/JS | Fast aur mobile-friendly |
| Backend | Node.js + Express | Seekhna aur maintain karna aasan |
| Database | PostgreSQL ya MongoDB | Bookings, parcels, rates store karne ke liye |
| Payment | Razorpay | UPI, card, net banking, India mein common |
| SMS/Email | MSG91 / Fast2SMS + Gmail SMTP | Booking aur tracking updates ke liye |
| Hosting | Vercel (frontend) + Render/Railway (backend) | Shuru mein kam kharcha |
| Domain | sncscourier.in jaisa naam | Professional look |

## 3. Database tables
- **customers:** name, mobile, email, `first_booking_used` (true/false)
- **bookings:** id, tracking_id, sender, receiver, pickup address, weight, L×W×H, zone, amount, discount, payment_status
- **parcel_events:** tracking_id, hub name, status, time (isse timeline banti hai)
- **rates:** zone, first-kg price, extra-kg price, delivery days, hub stops
- **pincodes:** pin, city, serviceable (yes/no)
- **offers:** text, start date, end date, on/off

## 4. Phase-wise plan

### Phase 1: Tayyari (2-3 din)
- [ ] Asli rates, zones, hubs aur serviceable pin codes ki list jama karna
- [ ] Logo, brand colour, shop ki photo
- [ ] Razorpay account ke liye business documents (PAN, bank details, GST agar ho)

### Phase 2: Design aur Frontend (1 hafta)
- [x] Home page, 4 bade buttons (Book, Track, Price, Pin code)
- [x] Mobile par test, light/dark mode, Hindi toggle (optional)
- [x] Festive offer banner ka block

### Phase 3: Backend aur Logic (1-2 hafte)
- [x] Price calculator: chargeable weight = max(actual weight, L×W×H ÷ 5000)
- [x] Pin code checker database se
- [x] Booking form aur tracking ID generate karna (jaise SNCS1024)
- [x] Rs 50 first-user discount: mobile number se check, sirf pehli booking par

### Phase 4: Payment (3-5 din)
- [x] Razorpay integrate karna (UPI, card, net banking) aur "Cash at pickup" option
- [x] Payment success par hi booking confirm karna
- [x] Confirmation SMS/email bhejna

### Phase 5: Tracking (3-4 din)
- [x] Tracking ID dalne par timeline: Picked up → Hub 1 → Hub 2 → Out for delivery → Delivered
- [x] Stoppages ki sankhya aur expected delivery date dikhana

### Phase 6: Admin Panel (1 hafta)
- [x] Password-protected login
- [x] Bookings ki list, status update ka button har hub par
- [x] Rates, pin codes aur offers edit karna
- [x] Daily report download (Excel/CSV)

### Phase 7: Testing aur Security (3-4 din)
- [ ] Form validation, HTTPS, spam protection
- [ ] Test payment (Razorpay test mode) se poora flow check karna
- [ ] Phone aur laptop dono par test

### Phase 8: Launch (2-3 din)
- [ ] Domain aur hosting jodna
- [ ] Google Business Profile par shop register karna (Ranchi searches ke liye bahut zaroori)
- [ ] Papa aur staff ko 1 ghante ki training

**Kul samay:** lagbhag 4-6 hafte.

## 5. Roz ka kaam kaise chalega
1. Customer website par booking karke pay karta hai
2. Admin panel mein nayi booking dikhti hai, staff pickup bhejta hai
3. Har hub par staff status update karta hai, customer ko tracking mein dikhta hai
4. Delivery par status "Delivered" kar diya jata hai

## 6. Kharcha (andaza, badal sakta hai)
- Domain: kuch hazaar rupaye se kam per year
- Hosting: shuru mein free tier ya kam monthly kharcha
- Razorpay: setup free, har transaction par % fee lagti hai
- SMS: per message chhota charge

Exact prices alag-alag provider par badalte rehte hain, isliye order dene se pehle unki site par check kar lena.

## 7. Risks aur dhyan dene wali baatein
- **Rate galat hone ka risk:** pehle thode weeks ke liye final price pickup par confirm karna
- **Staff adoption:** agar hubs par status update nahi hua to tracking bekaar ho jayegi, isliye admin panel bahut simple rakhna
- **Customer data:** mobile numbers aur addresses safe rakhna, password hamesha encrypted
- **Backup:** database ka roz automatic backup

## 8. Aapse chahiye
1. Asli rates (zone ke hisaab se) aur delivery days
2. Kaun se shehar/state aur pin codes serve karte ho
3. Hubs ke naam aur route (Ranchi → kahan → kahan)
4. Logo ya brand colour ki pasand
5. Staff mobile se update karega ya laptop se?
