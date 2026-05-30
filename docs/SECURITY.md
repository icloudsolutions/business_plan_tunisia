# Security — Step 1 (access control)

## Authentication

- All business routes require `Authorization: Bearer <JWT>` except:
  - `GET /api/health`
  - `POST /api/auth/register` (clients only)
  - `POST /api/auth/login`

## Expert accounts

- Public registration **cannot** create `expert` roles.
- Create experts via:

```bash
curl -X POST http://localhost/api/auth/admin/experts \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"email":"expert@company.tn","password":"securepassword"}'
```

## Plan access

| Role | Visibility |
|------|------------|
| **client** | Own plans only (`owner_id`) |
| **expert** | Plans where `assigned_expert_id` matches and status ≠ `DRAFT` |
| **admin** | All plans (reserved for future use) |

On **submit**, the API assigns `assigned_expert_id` from `ASSIGN_EXPERT_EMAIL` or the first expert in the database.

## Jobs

`GET /api/jobs/{id}` verifies the caller may access the parent plan before returning results.

## Production checklist

1. Set strong `JWT_SECRET` and `ADMIN_API_KEY` in `.env`
2. Set `RUN_SEED=false`
3. Set `APP_ENV=production`
4. Configure `CORS_ORIGINS` to your front-end domain only
5. Do not expose postgres/redis ports on the host
