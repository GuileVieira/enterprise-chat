# Tenant Operations Guide

> Practical guide for managing tenants in LibreChat. Tenants provide logical data isolation between organizations or teams.

---

## What is a Tenant?

In LibreChat, a **tenant** is not a separate entity — it is simply a `tenantId` string assigned to users and their data. All documents (conversations, messages, agents, files, etc.) are scoped by `tenantId` through the Mongoose tenant isolation plugin.

- Users with the same `tenantId` share a data scope
- Users without a `tenantId` belong to the `default` tenant
- Tenant isolation is automatic at the database query level

---

## Creating a Tenant

There is no explicit "create tenant" operation. A tenant is created implicitly when you assign a `tenantId` to a user.

### Via CLI

```bash
npm run create-user -- \
  user@company.com \
  "John Doe" \
  johndoe \
  --tenant=acme
```

This creates a user under the `acme` tenant. Any data this user creates (conversations, agents, files) will be scoped to `acme`.

### Via Admin Panel

1. Go to **Admin > Users**
2. Click **Create User**
3. Fill in email, name, username
4. Set the **Tenant** field (e.g., `acme`)
5. Choose **Role** (USER or ADMIN)
6. Submit

The user will be created and assigned to the specified tenant.

---

## Listing Tenants

### Via CLI

There is no dedicated CLI for listing tenants yet. Use MongoDB directly:

```bash
mongosh LibreChat --eval 'db.users.distinct("tenantId")'
```

### Via Admin Panel

1. Go to **Admin > Tenants**
2. See all tenants with user counts
3. Click a tenant to view its users and stats

---

## Managing Users Within a Tenant

### Via CLI

```bash
# Create another user in the same tenant
npm run create-user -- \
  jane@company.com \
  "Jane Smith" \
  janesmith \
  --tenant=acme
```

### Via Admin Panel

1. Go to **Admin > Tenants > [tenant name]**
2. View all users in the tenant
3. Use **Admin > Users > Create User** to add more users

---

## Creating Tenant Functions

Tenant Functions are custom tools scoped to a specific tenant.

### 1. Create a Secret

```bash
npm run create-secret -- \
  --tenant=acme \
  --name=meta-ads-token \
  --type=bearer \
  --value="EAAxxxxxxxx"
```

### 2. Create a Function Definition

Create a JSON file `meta-ads.json`:

```json
{
  "id": "meta-ads-relatorio",
  "name": "Meta Ads - Campaign Report",
  "description": "Lists campaigns and performance metrics from a Meta Ads account.",
  "config": {
    "baseUrl": "https://graph.facebook.com/v18.0",
    "method": "GET",
    "path": "/act_{adAccountId}/campaigns",
    "auth": {
      "type": "bearer",
      "secretName": "meta-ads-token"
    }
  },
  "inputSchema": {
    "adAccountId": {
      "type": "string",
      "description": "Ad account ID (act_123456789)",
      "required": true
    }
  }
}
```

### 3. Register the Function

```bash
npm run create-function -- \
  --tenant=acme \
  --file=meta-ads.json
```

### 4. Attach to an Agent

In the agent builder UI, add `meta-ads-relatorio` to the agent's tools list.

---

## Tenant Isolation

### How it Works

- The `tenantStorage` AsyncLocalStorage wraps every request
- Mongoose tenant isolation plugin automatically injects `tenantId` into queries
- A user from tenant A cannot read/write data from tenant B

### System Operations

For cross-tenant operations (e.g., migrations, admin stats), use `runAsSystem`:

```ts
import { runAsSystem } from '@librechat/data-schemas';

await runAsSystem(async () => {
  // This bypasses tenant isolation
  const allUsers = await User.find({});
});
```

---

## CLI Reference

### User Management

```bash
# Create user with tenant
npm run create-user -- <email> <name> <username> [--tenant=<tenantId>]

# List tenant functions
npm run list-functions -- --tenant=<tenantId>

# Create tenant secret
npm run create-secret -- --tenant=<tenantId> --name=<name> --type=<type> --value=<value>

# Create tenant function
npm run create-function -- --tenant=<tenantId> --file=<path>
```

### Admin Panel URLs

| Page | URL |
|---|---|
| Tenants List | `/admin/tenants` |
| Tenant Detail | `/admin/tenants/:tenantId` |
| Users | `/admin/users` |
| Create User | `/admin/users` (click Create User) |

---

## Strict Mode (`TENANT_ISOLATION_STRICT=true`)

When strict mode is enabled, **every database query must have a tenant context**. This prevents accidental cross-tenant data leaks but requires proper infrastructure configuration.

### Reverse Proxy Configuration

Your reverse proxy (nginx, Traefik, Cloudflare, etc.) **must** inject the `X-Tenant-Id` header on every incoming request. Without it, unauthenticated routes (login, registration, password reset, OAuth callbacks, banners) will fail with:

```
[TenantIsolation] Query attempted without tenant context in strict mode
```

### nginx Example

```nginx
server {
  listen 80;
  server_name acme.yourapp.com;

  location / {
    proxy_set_header X-Tenant-Id "acme";
    proxy_pass http://librechat:3080;
  }
}
```

### Traefik Example

```yaml
http:
  routers:
    acme:
      rule: "Host(`acme.yourapp.com`)"
      middlewares:
        - "add-tenant-header"
      service: "librechat"

  middlewares:
    add-tenant-header:
      headers:
        customRequestHeaders:
          X-Tenant-Id: "acme"
```

### Subdomain-to-Tenant Mapping

If you use one subdomain per tenant, map the subdomain to the header:

```nginx
map $host $tenant_id {
  default "default";
  "acme.yourapp.com" "acme";
  "beta.yourapp.com" "beta";
}

server {
  location / {
    proxy_set_header X-Tenant-Id $tenant_id;
    proxy_pass http://librechat:3080;
  }
}
```

### Important Notes

- The header name is case-insensitive but must be exactly `X-Tenant-Id`
- Never allow end users to set this header directly — always inject it at the proxy level
- System-level background tasks (index sync, migrations) run with `runAsSystem()` and bypass tenant isolation

---

## Files Added/Modified

| File | Purpose |
|---|---|
| `config/create-user.js` | Updated to accept `--tenant` flag |
| `api/server/routes/admin/tenants.js` | API routes for tenant management |
| `packages/api/src/admin/tenants.ts` | Handler factory for tenant operations |
| `client/src/components/Admin/Tenants/` | TenantsPage and TenantDetailPage |
| `client/src/components/Admin/Users/CreateUserModal.tsx` | Modal to create users with tenant |
| `docs/TENANT_OPERATIONS.md` | This documentation |
