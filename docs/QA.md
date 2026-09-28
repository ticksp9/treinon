# QA Documentation — TaticalSoccer

## Running Tests

### All tests
```bash
npm test
```

### By suite
```bash
npm run test:unit         # Business logic & rules
npm run test:integration  # Cross-module flows
npm run test:security     # RLS & access control
npm run test:smoke        # Quick integrity checks
npm run test:regression   # Critical path protection
npm run test:coverage     # With coverage report
npm run test:ci           # Verbose output for CI
```

### Watch mode
```bash
npm run test:watch
```

## Test Structure

```
src/test/
├── fixtures/
│   ├── invite-fixtures.ts    # Mock IDs, template data, sample templates
│   ├── factories.ts          # Reusable data factories
│   └── qa-matrix.ts          # Permission matrix by role
├── helpers/
│   └── template-helpers.ts   # Template engine test utilities
├── unit/                     # Pure logic tests (fast, no backend)
│   ├── constants.test.ts
│   ├── template-parser.test.ts
│   ├── template-renderer.test.ts
│   ├── template-sanitizer.test.ts
│   ├── template-validator.test.ts
│   ├── template-catalog.test.ts
│   ├── invite-validation.test.ts
│   ├── membership-rules.test.ts
│   ├── delivery-status.test.ts
│   ├── redirect-rules.test.ts
│   └── invite-templates-compat.test.ts
├── integration/              # Cross-module interaction tests
│   ├── invite-accept-flow.test.ts
│   ├── communication-access.test.ts
│   ├── delivery-system.test.ts
│   ├── invite-tracking.test.ts
│   └── template-full-flow.test.ts
├── security/                 # Access control & RLS tests
│   ├── edge-function-contracts.test.ts
│   ├── rls-context-isolation.test.ts
│   ├── hardening-verification.test.ts
│   ├── qa-permission-matrix.test.ts
│   └── rls-assertions.test.ts
├── smoke/                    # Fast integrity checks
│   ├── app-smoke.test.ts
│   └── critical-smoke.test.ts
└── regression/               # Critical path protection
    └── critical-flows.test.ts
```

## Factories

All factories are in `src/test/fixtures/factories.ts`:

| Factory | Description |
|---------|-------------|
| `createTestClub()` | Club with defaults |
| `createTestTeam()` | Team with defaults |
| `createTestPlayer()` | Player with defaults |
| `createTestInvite()` | Pending invite |
| `createAcceptedInvite()` | Already accepted invite |
| `createExpiredInvite()` | Expired invite |
| `createRevokedInvite()` | Revoked invite |
| `createTestChannel()` | Communication channel |
| `createTestMembership()` | Channel membership |
| `createTestDelivery()` | Delivery row |
| `createTestEvent()` | Audit event |
| `createTestTemplate()` | Invite template |

All accept `Partial<T>` overrides.

## Adding New Tests

1. Place in appropriate suite directory
2. Use factories for test data
3. Use `resetIdCounter()` in `beforeEach` for deterministic IDs
4. Follow naming: `feature-name.test.ts`

## Coverage

Run `npm run test:coverage` for report. Thresholds enforced on:
- `src/lib/template-engine/**` — 80% statements/functions/lines

## CI/CD Strategy

**On PR:** `npm run test:ci` runs all suites with verbose output.
**Critical failures block merge.**

### Recommended CI pipeline:
1. `npm ci`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm run test:ci`
