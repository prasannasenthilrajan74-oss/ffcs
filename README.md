# VITSION Movie Makers — Department Allocation System

A production-ready web application for the VITSION Movie Makers Club department selection process.

## Tech Stack

| Layer      | Technology |
|------------|-----------|
| Frontend   | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| Backend    | Node.js + Express + TypeScript |
| Database   | MongoDB Atlas |
| Auth       | JWT (httpOnly cookie) |
| Deployment | Frontend → Vercel · Backend → Render |

---

## 1. MongoDB Atlas Setup

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) and create a free M0 cluster
2. Create a database user (username + password)
3. Allow network access from `0.0.0.0/0` (for Render deployment)
4. Get the connection string: `mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/vitsion-allocation?retryWrites=true&w=majority`
5. **Seed departments** after first deploy (see Step 5 below)

---

## 2. Environment Variables

### Backend (`backend/.env`)

Copy from `backend/.env.example`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/vitsion-allocation?retryWrites=true&w=majority
ADMIN_EMAIL=admin@vitsionmoviemakers.com
ADMIN_PASSWORD=YourSecurePassword123!
JWT_SECRET=a_very_long_random_string_at_least_32_characters_long
CLIENT_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
```

> ⚠️ **NEVER commit `.env` to Git. Use `.env.example` as template only.**

### Frontend (`frontend/.env`)

```env
VITE_API_URL=https://your-backend.onrender.com
```

---

## 3. Backend Deployment (Render)

1. Go to [https://render.com](https://render.com) and create a new **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Node Version**: 18+
4. Add all environment variables from Step 2 (Backend)
5. Deploy and note the URL (e.g. `https://vitsion-backend.onrender.com`)

---

## 4. Frontend Deployment (Vercel)

1. Go to [https://vercel.com](https://vercel.com) and import your repository
2. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add environment variable: `VITE_API_URL=https://vitsion-backend.onrender.com`
4. Deploy

---

## 5. Seed Departments (REQUIRED after first deploy)

After backend is deployed, seed the 8 departments with initial capacities:

**Locally (if you have backend .env set up):**
```bash
cd backend
npm run seed
```

**On Render (via Shell):**
```bash
node -e "
require('dotenv').config();
const mongoose = require('./dist/config/db');
// Or just run the seed script directly
"
```

> Alternatively, run `npm run seed` locally with the production `MONGODB_URI` in your `.env`.

The seed creates all 8 departments with these initial capacities:

| Department       | Capacity |
|------------------|-------:|
| Outreach         | 15     |
| Creative         | 20     |
| Editorial        | 15     |
| Publicity        | 15     |
| Event Management | 20     |
| Photography      | 15     |
| Editing          | 16     |
| Projects         | 15     |

---

## 6. Admin Credential Configuration

Set these in the Render environment variables (never hardcode):

```
ADMIN_EMAIL=admin@vitsionmoviemakers.com
ADMIN_PASSWORD=YourVerySecurePassword
JWT_SECRET=random_32+_character_string
```

Access the admin panel at: `https://your-frontend.vercel.app/admin/login`

---

## 7. Changing Department Capacities

### Before recruitment begins:
1. Log in to Admin → `/admin/departments`
2. Click the edit (pencil) icon next to any department
3. Type the new capacity and press Enter or click ✓

### Via seed script (before any submissions):
Edit `backend/src/scripts/seed.ts`, change the `INITIAL_CAPACITIES` values, then run `npm run seed`.

> ⚠️ If you reduce capacity below current allocations, the system will show a warning and require confirmation. **Existing confirmed allocations are never automatically removed.**

---

## 8. Development Setup

### Backend
```bash
cd backend
cp .env.example .env
# Fill in your MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET
npm install
npm run seed          # seed departments
npm run dev           # starts on port 5000
```

### Frontend
```bash
cd frontend
cp .env.example .env  # leave VITE_API_URL empty for proxy
npm install
npm run dev           # starts on port 5173, proxies /api → localhost:5000
```

### Reset test data (dev only)
```bash
cd backend
npm run reset         # deletes all applicants, resets allocatedCount to 0
```

---

## 9. FCFS Concurrency Design

The allocation engine uses **MongoDB atomic conditional update**:

```typescript
// This is a single atomic server-side operation
Department.findOneAndUpdate(
  {
    name: deptName,
    $expr: { $lt: ['$allocatedCount', '$capacity'] }  // check seat available
  },
  { $inc: { allocatedCount: 1 } },                    // claim seat
  { session }
)
```

- Returns `null` if no seat was available (another request claimed it first)
- MongoDB document-level locking guarantees exactly-once semantics
- Wrapped in a MongoDB transaction with the applicant save
- **Frontend never determines seat availability** — all logic is server-side

---

## 10. Security Notes

- Admin JWT stored in **httpOnly cookie only** (not localStorage)
- Login rate limited: 5 attempts per 15 minutes
- Registration rate limited: 5 per minute per IP
- CORS restricted to `CLIENT_ORIGIN` env var
- Helmet.js security headers enabled
- Input validated server-side with express-validator
- Only `@vitstudent.ac.in` emails accepted
- Server always generates `submittedAt` — never from client

---

## 11. Production Testing Checklist

After deployment, verify:

- [ ] Open `https://your-frontend.vercel.app` — homepage loads
- [ ] Register with a `@vitstudent.ac.in` email — get CONFIRMED result
- [ ] Try same email again — get duplicate rejection message
- [ ] Try same registration number — get duplicate rejection message
- [ ] Admin login at `/admin/login` — dashboard loads
- [ ] Dashboard shows correct counts
- [ ] Search and filter work in Applicants table
- [ ] Export CSV downloads correctly
- [ ] Department capacity edit works (with warning for over-capacity)
- [ ] Registration open/close toggle works
- [ ] Mobile viewport test on phone

---

## API Reference

```
POST   /api/applications                    Register applicant
GET    /api/applications/:applicationNumber Get result by number
GET    /api/departments                     Public department list

POST   /api/admin/login                     Admin login
POST   /api/admin/logout                    Admin logout
GET    /api/admin/me                        Auth check
GET    /api/admin/stats                     Dashboard stats
GET    /api/admin/applications              Applicant list (search/filter/sort/page)
GET    /api/admin/departments               Department list
PATCH  /api/admin/departments/:id           Update capacity
GET    /api/admin/export                    CSV export (all or ?department=Name)
GET    /api/admin/settings                  Get settings
PATCH  /api/admin/settings                  Update settings (registrationOpen)
GET    /health                              Health check
```
