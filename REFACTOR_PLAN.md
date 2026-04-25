# Frontend API & Data Flow Refactor Plan

## 🎯 Goal
Consolidate all frontend-to-backend communication into a single, unified, and type-safe API service. This will eliminate redundant code, ensure consistent error handling, and simplify state management across the application.

## 🚩 Current Issues
1. **API Fragmentation**: We have logic split between `lib/api.ts`, `lib/auth.ts`, and raw `fetch` calls inside components.
2. **Manual Token Handling**: Multiple files manually parse `document.cookie` to find the `auth_token`.
3. **Inconsistent Responses**: Some functions return data directly, some return `{ success, data }`, and others throw raw Errors.
4. **Mega-Component Bloat**: Pages like `showcases/page.tsx` are managing too much local state, making data flow difficult to track.

## 🏗️ New Architecture

### 1. Unified Token Management (`lib/token.ts`)
A dedicated utility for getting, setting, and removing the `auth_token` from cookies. This prevents circular dependencies between the API client and Auth Context.

### 2. Centralized API Client (`lib/api-service.ts`)
A single `api` singleton that uses a private `request` method to handle:
- Automatic Authorization header injection.
- Global 401 (Unauthorized) interception and logout.
- Unified response format: `Promise<ApiResponse<T>>` which always returns `{ success: boolean, data?: T, error?: string }`.

### 3. Namespaced Services
Instead of a flat list of functions, the API is organized by domain:
- `api.auth.*`
- `api.properties.*`
- `api.collections.*`
- `api.analytics.*`

## 🚀 Roadmap

### Phase 1: Authentication (In Progress)
- [x] Create `lib/token.ts`
- [x] Create `lib/api-service.ts`
- [ ] Refactor `(auth)/register` page and `EmailVerificationInput` component.
- [ ] Refactor `(auth)/login` page.
- [ ] Update `AuthContext.tsx` to use the new `api.auth.me()` call.

### Phase 2: Core Features
- [ ] Refactor `open-house/` routes to use `api.properties` and `api.openHouse`.
- [ ] Refactor `showcases/` and `settings/subscription` to use `api.collections` and `api.paypal`.
- [ ] Refactor `checkout/` to use the unified client (eliminating raw `fetch`).

### Phase 3: Cleanup
- [ ] Ensure no component imports from the old `lib/api.ts` or `lib/auth.ts`.
- [ ] Delete legacy `lib/api.ts` and `lib/auth.ts`.
- [ ] Remove unused components identified during the cleanup (e.g., `MultiCityInput`, `PrintButton`).

## 📝 Coding Standards
- **Never use raw `fetch`** inside a component or page.
- **Always use the `api` singleton**: `const { success, data, error } = await api.auth.login(current)`.
- **Handle errors gracefully** using the returned `error` string instead of generic `try/catch` blocks where possible.
