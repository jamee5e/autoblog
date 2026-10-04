# autoblog

KSD Auto Blog backend service.

## WordPress Integration (Phase 2)

### Environment

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default: `12h`)
- `ENCRYPTION_KEY` (used to encrypt WordPress Application Passwords before database storage)
- `SEED_ADMIN_EMAIL` (required for seed)
- `SEED_ADMIN_PASSWORD` (required for seed)

### Database setup

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Available API endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/websites`
- `GET /api/websites`
- `GET /api/websites/:id`
- `PUT /api/websites/:id`
- `POST /api/websites/:id/test-connection`
- `POST /api/websites/:id/test-draft`
- `GET /api/system-logs`
- `GET /api/articles`
- `GET /api/articles/:id`
- `GET /api/articles/permissions`

### Frontend routes

- `/login`
- `/dashboard`
- `/websites`
- `/system-logs`
- `/articles`
- `/articles/preview?id=<articleId>`

### Notes

- Authentication uses JWT bearer tokens.
- `/api/websites/*`, `/api/companies/*`, and `/api/articles/*` require authentication.
- Website access is company-scoped by authenticated user company.
- `ADMIN` can manage WordPress website configuration and connection testing.
- `EDITOR` has read-only access to website listing/details and can use article routes (when implemented).
- Frontend currently stores JWT in `sessionStorage` for development.
- WordPress URLs are validated as `https://...` and normalized before storage.
- WordPress REST base URL is built as: `<wordpressUrl>/wp-json/wp/v2`
- WordPress Application Passwords are encrypted at rest and never returned by APIs.
