# The 5,000 People Project: API

Express + TypeScript + MongoDB (Mongoose) + Cloudinary + JWT (httpOnly cookie). This is the backend for the [client](../client) site (separate repository). All secrets live only here.

## Requirements

- Node.js 20+
- MongoDB ([Atlas](https://www.mongodb.com/atlas) free tier or local `mongod`)
- A [Cloudinary](https://cloudinary.com) account for photo and video uploads

## Setup

```bash
npm install
cp .env.example .env     # then fill it in
npm run create-admin -- you@example.com "a-long-strong-password"
npm run dev              # http://localhost:4000
```

### Environment variables

| Variable | Description |
| --- | --- |
| `PORT` | API port (default `4000`) |
| `CLIENT_ORIGIN` | Public URL(s) of the site, comma separated. Used for CORS and the CSRF origin check |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Random string, **32+ characters**. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Session length, default `7d` |
| `COOKIE_SAMESITE` | `lax` (default) or `none`, see Deployment |
| `COOKIE_DOMAIN` | Optional, e.g. `.example.com` when client and API are sibling subdomains |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | From the Cloudinary dashboard |

The server refuses to start if `MONGODB_URI` or `JWT_SECRET` is missing. Without Cloudinary it still runs, logs a warning, and uploads return a clear `503`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type-check only |
| `npm run create-admin -- <email> "<password>"` | Create or reset the admin (10+ char password, bcrypt hashed). There is no public sign-up |
| `npm run seed:demo` / `seed:demo:remove` | Add or remove clearly labelled demo people (refuses to run in production). The demo portraits are served by the client from `public/demo/`, so the client repo must be running. Remove demo data before adding real people |

## Participant numbering

- Numbers come from an atomic MongoDB counter (`findOneAndUpdate` + `$inc`) with a unique index, so they can't duplicate.
- Four digits in the UI (`0001`), never reused. Deleting someone does not free their number.
- Media is uploaded **before** a number is taken, so a failed upload never burns a number.
- The project counts **unique people**. A name that already exists must be confirmed as a different person, or logged as **returning** (`returnCount` goes up, no new number).

## Privacy and consent

- Public endpoints only return participants that are `isPublished` **and** `consentConfirmed`, and only approved public fields. Cloudinary IDs, consent flags and internal IDs are never exposed.
- Publishing without consent is blocked in the service layer and the Mongoose model. Withdrawing consent unpublishes.
- To honour a removal request: unpublish (hides immediately) or delete (also deletes Cloudinary media).
- Phone numbers, addresses and personal social handles are never stored.

## API

Public: `GET /api/participants` (`page, limit, q, sort, location, event`), `/api/participants/latest`, `/api/participants/filters`, `/api/participants/:number`, `/api/stats`, `/api/settings`, `/api/health`

Admin (cookie auth, plus an `X-Requested-With` header on writes): `POST /api/admin/auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /overview`, `GET|POST /participants`, `GET|PUT|DELETE /participants/:id`, `PATCH /participants/:id/publish`, `POST /participants/:id/returning`, `GET|PUT /settings`

## Security

- JWT in an `httpOnly`, `Secure` (production) cookie, never readable by JavaScript.
- CSRF defence: custom `X-Requested-With` header + allowed `Origin` check on state-changing admin requests, on top of `SameSite` cookies and a CORS allow-list.
- Helmet, Zod request validation, upload type/size checks, login rate limiting, central error handling.

## Deployment

1. Create a MongoDB Atlas cluster and allow the server's IP.
2. Host the API (Render, Railway, Fly.io, a VPS...) with the variables above set as environment variables. Build with `npm run build`, start with `npm start`. Set `CLIENT_ORIGIN` to the site URL.
3. Run `npm run create-admin` once against production.
4. Cookies across domains:
   - Same parent domain (`example.com` + `api.example.com`): `COOKIE_SAMESITE=lax`, `COOKIE_DOMAIN=.example.com`.
   - Different domains (`*.vercel.app` + `*.onrender.com`): `COOKIE_SAMESITE=none` (forces `Secure`, needs HTTPS).

## Structure

```
server.ts          entry point
src/app.ts         Express app
src/config/        env, MongoDB, Cloudinary
src/models/        Participant, Admin, Settings, Counter
src/routes/        public + admin routers
src/services/      participants, media, settings, stats
src/middleware/    auth + CSRF, uploads, error handler
src/validators/    Zod schemas
src/scripts/       createAdmin, seedDemo
```
