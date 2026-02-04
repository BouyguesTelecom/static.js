# Security Analysis Report - StaticJS

**Date**: 2026-02-04
**Analyst**: Security Review
**Version**: 0.1.13

---

## Executive Summary

This security analysis identified **3 critical**, **5 high**, **5 medium**, and **4 low** severity findings in the StaticJS codebase. **All 3 critical issues have been fixed.**

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | **FIXED** |
| HIGH | 5 | 1 Fixed, 4 Pending |
| MEDIUM | 5 | Pending |
| LOW | 4 | Pending |

---

## Critical Findings (FIXED)

### 1. TLS Certificate Validation Disabled - FIXED

**Locations**:
- `lib/scripts/build-html.ts:10`
- `lib/helpers/renderPageRuntime.ts:1`
- `lib/server/scripts/revalidate.ts:25`

**Issue**:
```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

Setting this globally disables TLS certificate validation, making the application vulnerable to man-in-the-middle (MITM) attacks.

**Impact**: Any HTTPS connections can be intercepted by attackers.

**Fix Applied**: Removed all `NODE_TLS_REJECT_UNAUTHORIZED = "0"` lines from the codebase.

---

### 2. Command Injection Risk in Revalidate Endpoint - FIXED

**Location**: `lib/server/scripts/revalidate.ts`

**Issue**: User-provided paths were passed to `execFile` with insufficient validation.

**Impact**: Path traversal and potential command injection through crafted inputs.

**Fix Applied**:
- Stricter regex validation: no slashes allowed (`/^[a-zA-Z0-9_-]+$/`)
- Path length limit (256 characters max)
- Path boundary validation: verifies paths resolve within `src/pages/` directory
- Directory existence check before accepting paths
- Safe environment variables: only PATH, HOME, NODE_ENV passed to child processes
- Security logging for rejected paths

---

### 3. Unsafe Dynamic Module Import - FIXED

**Location**: `lib/server/config/index.ts`

**Issue**: Dynamic import of user-controlled TypeScript files without validation.

**Impact**: An attacker who can modify `static.config.ts` gains full code execution on the server.

**Fix Applied**:
- Whitelist of allowed configuration keys
- Type validators for each config key with strict bounds:
  - PORT: 1-65535
  - NODE_ENV: only 'development', 'production', 'test'
  - BUILD_DIR: alphanumeric only, max 64 chars
  - REQUEST_TIMEOUT: max 300000ms
  - etc.
- Unknown keys are logged and ignored
- Invalid values are logged and rejected

---

## High Severity Findings

### 4. Unprotected Revalidate Endpoint - FIXED

**Location**: `lib/server/routes/api.ts`

**Issue**: The `/revalidate` POST endpoint had rate limiting but no authentication.

**Impact**: Any unauthenticated user could trigger expensive rebuild operations (DoS potential).

**Fix Applied**:
- Added API key authentication middleware (`revalidateAuth`)
- Supports `Authorization: Bearer <key>` or `X-API-Key` header
- Uses timing-safe comparison to prevent timing attacks
- In development: allows requests without API key if none configured
- In production: requires `REVALIDATE_API_KEY` environment variable or config
- API key must be 16-256 characters long

---

### 5. Environment Variable Leakage

**Location**: `lib/server/scripts/revalidate.ts:25`

**Issue**:
```typescript
{ env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" } }
```

All environment variables (including secrets) are passed to child processes.

**Recommendation**: Only pass necessary, non-sensitive environment variables.

---

### 6. Overly Permissive CORS Configuration

**Location**: `lib/server/middleware/security.ts:31-34`

**Issue**:
```typescript
export const corsMiddleware = cors({
    origin: true,  // Allows ALL origins
    credentials: true,
});
```

**Impact**: Bypasses CSRF protection when credentials are sent.

**Recommendation**: Configure explicit allowed origins from environment variable or whitelist.

---

### 7. Weak Content Security Policy

**Location**: `lib/server/middleware/security.ts:15-25`

**Issues**:
- `'unsafe-inline'` for styles defeats XSS protection
- `"https:"` for imgSrc allows any HTTPS domain
- Missing `object-src`, `base-uri`, `form-action` directives

**Recommendation**: Remove `'unsafe-inline'`, whitelist specific domains, add missing directives.

---

### 8. Information Exposure in Health Endpoint

**Location**: `lib/server/routes/api.ts:43-54`

**Issue**: Health endpoint exposes memory usage, Node version, and uptime without authentication.

**Recommendation**: Restrict detailed health info to authenticated requests or internal IPs.

---

## Medium Severity Findings

### 9. Path Traversal in listPages

**Location**: `lib/server/routes/api.ts:121-151`

**Issue**: No verification that resolved paths stay within the intended build directory.

**Recommendation**: Add path boundary validation after resolution.

---

### 10. Synchronous File Operations

**Location**: `lib/server/middleware/hotReload.ts:28-67`

**Issue**: `fs.readFileSync` blocks the event loop during startup.

**Recommendation**: Use async file operations with caching.

---

### 11. No HTTPS Enforcement

**Location**: `lib/server/middleware/security.ts`

**Issue**: No HSTS headers or HTTP-to-HTTPS redirect in production.

**Recommendation**: Enable `strictTransportSecurity` in Helmet configuration.

---

### 12. Missing Rate Limit Granularity

**Location**: `lib/server/routes/api.ts:157`

**Issue**: Health endpoint shares general rate limiting but provides reconnaissance data.

---

### 13. Dynamic Regex Construction

**Location**: `lib/helpers/renderPageRuntime.ts:70-95`

**Issue**: Regex patterns built from page names could cause ReDoS with special characters.

**Recommendation**: Use safer matching algorithms or strictly validate page names.

---

## Low Severity Findings

### 14. IP Logging Privacy

**Location**: `lib/server/middleware/errorHandling.ts:29-50`

**Issue**: Client IPs are logged, which may have GDPR implications.

---

### 15. WebSocket No Origin Validation

**Location**: `lib/server/utils/websocket.ts:30-96`

**Issue**: WebSocket server has no origin or authentication checks.

**Note**: Mitigated by development-only usage.

---

### 16. Symlink Following in File Watcher

**Location**: `lib/server/utils/fileWatcher.ts:133`

**Issue**: `followSymlinks: true` could allow monitoring files outside intended directories.

---

### 17. Inconsistent Security Headers

**Issue**: `X-Content-Type-Options` not consistently applied across all response types.

---

## Security Features Properly Implemented

| Feature | Location | Status |
|---------|----------|--------|
| Rate Limiting | `middleware/rateLimiting.ts` | Configured (100/15min general, 10/15min revalidate) |
| Helmet Headers | `middleware/security.ts` | Basic protections enabled |
| Request Timeout | `middleware/performance.ts` | 30 seconds configured |
| Body Size Limits | `middleware/parsing.ts` | 10MB for JSON and URL-encoded |
| Error Filtering | `middleware/errorHandling.ts` | Stack traces hidden in production |
| Cache Headers | `middleware/static.ts` | Properly configured per environment |

---

## Immediate Actions Required

1. ~~**Remove all `NODE_TLS_REJECT_UNAUTHORIZED = "0"` lines**~~ - DONE
2. ~~**Add authentication to `/revalidate` endpoint**~~ - DONE
3. ~~**Implement path whitelist validation for revalidate**~~ - DONE
4. ~~**Validate `static.config.ts` imports with schema**~~ - DONE
5. **Fix CSP configuration (remove `unsafe-inline`)** - HIGH priority
6. **Implement CORS origin whitelist** - HIGH priority

---

## Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| helmet | 8.0.0 | Current |
| express | 5.0.1 | Current |
| express-rate-limit | 8.0.1 | Current |
| ws | 8.18.0 | Current |

**Recommendation**: Run `npm audit` regularly to catch transitive vulnerabilities.

---

## Testing Checklist

- [ ] Attempt path traversal in revalidate: `../../etc/passwd`
- [ ] Test CORS preflight with unauthorized origins
- [ ] Verify TLS validation with self-signed certificates
- [ ] Test revalidate endpoint without authentication
- [ ] Check health endpoint for sensitive data exposure
- [ ] Validate CSP blocks inline scripts/styles
- [ ] Test rate limiting under load

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-04 | 1.0 | Initial security analysis |
| 2026-02-04 | 1.1 | Fixed all 3 critical issues (TLS validation, command injection, unsafe import) |
| 2026-02-04 | 1.2 | Fixed HIGH #4: Added API key authentication to revalidate endpoint |
