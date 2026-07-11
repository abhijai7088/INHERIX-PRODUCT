# Phase 2 - Authentication and Session Security

## What was built

- Production authentication endpoints in the backend under `/api/v1/auth/*`
- Password hashing with `bcryptjs`
- JWT access tokens and JWT refresh tokens
- Refresh-token rotation with hashed refresh-token storage in PostgreSQL
- Email verification and password reset token flows
- Session/device tracking in PostgreSQL
- Audit and security event logging for auth-sensitive actions
- Rate limiting for login, refresh, forgot password, reset password, and email verification requests
- Frontend onboarding pages wired to the production backend
- Middleware-based dashboard protection using the real backend session endpoint

## Auth architecture

- Browser login returns an access token in the response body and sets an HTTP-only refresh cookie
- The refresh cookie is scoped by environment variables and is not exposed to client JavaScript
- `GET /api/v1/auth/me` can authenticate with either the bearer access token or the refresh cookie
- Middleware uses `GET /api/v1/auth/me` to protect dashboard routes
- Sensitive backend actions enforce role, ownership, and session checks on the server

## Token and cookie model

- Access token TTL defaults to `15m`
- Refresh token TTL defaults to `30d`
- Refresh cookies are HTTP-only and `SameSite` controlled by environment
- Refresh cookies are `Secure` in production
- Refresh tokens are stored hashed in PostgreSQL, not in plain text
- Refresh token rotation updates the stored hash and revokes reuse attempts

## Password hashing

- `bcryptjs` is used for password hashing and verification
- Minimum password policy:
  - 8 characters
  - uppercase
  - lowercase
  - number
  - special character

## Session rotation behavior

- Each successful login creates a new session row in `user_sessions`
- Refresh tokens are rotated on `/auth/refresh-token`
- Reuse detection revokes the stored session
- Logout revokes the active session and clears the refresh cookie

## Email verification behavior

- Registration creates an email verification token in `auth_tokens`
- The development email provider logs links only in development
- Verification links point to the frontend `/onboarding/verify-email` route
- Email verification tokens are one-time use and expire quickly

## Forgot/reset password behavior

- Forgot password never reveals whether the email exists
- Reset tokens are one-time use and expire quickly
- Successful password reset revokes all active sessions for the user
- Reset links point to `/onboarding/reset-password`

## Frontend integration

- Onboarding pages now call the backend through `NEXT_PUBLIC_API_BASE_URL`
- Login and logout keep the refresh cookie in the browser
- Access tokens are held in memory only
- Dashboard protection is handled through the backend session check in `proxy.ts`

## Environment variables

Backend:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAME_SITE`
- `FRONTEND_ORIGIN`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `SENDGRID_API_KEY`
- `AWS_SES_REGION`
- `S3_BUCKET_NAME`
- `AWS_REGION`
- `AWS_KMS_KEY_ID`

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`

## Migrations

- `backend/migrations/0001_init.sql`
- `backend/migrations/0002_auth_phase2.sql`

## How to run

From `latest-code/`:

- `npm run backend:build`
- `npm run backend:test`
- `npm run lint`
- `npm run build`

## How to test the endpoints

- Open Swagger at the backend `/api/v1/docs` route
- Use the onboarding screens for register, login, verify email, forgot password, and reset password
- Use `/api/v1/auth/me` to confirm the authenticated profile
- Use `/api/v1/auth/sessions` to inspect active sessions

## Remaining Phase 3 work

- Full RBAC permission guards
- Permission seeding for roles and operations
- Admin authorization middleware
- Vault/document access enforcement
- Fine-grained route permission mapping

## Credentials still needed

For a production deployment, the exact values needed are:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_ORIGIN`
- Email provider choice: `sendgrid` or `ses`
- `EMAIL_FROM`
- `SENDGRID_API_KEY` if `sendgrid` is used
- `AWS_SES_REGION` if `ses` is used

Default decision used in code when credentials are not yet provided:

- Link-based email verification
- Development console email provider locally
- HTTP-only refresh cookie
- Access token returned in the JSON response and held in memory by the frontend

