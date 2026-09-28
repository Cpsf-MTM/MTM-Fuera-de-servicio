# Security Specification: Casino Santa Fe - Firebase Firestore

## 1. Data Invariants
- `maintenance_records`: Document ID must be alphanumeric and up to 128 chars.
- `estado` must strictly be one of `['egreso', 'tecnico', 'completo']`.
- Required fields on creation: `id`, `estado`, `egreso`, `created_at`, `updated_at`.
- Immutable fields on update: `id` and `created_at` cannot be altered.
- `backups`: Stores snapshot records with `id`, `label`, `recordCount`, `created_at`, `dataJson`.
- ID poisoning prevention: `isValidId(recordId)` guards single-document endpoints.
- Size constraints: String fields cannot exceed memory limits (e.g. `dataJson <= 1048576`).

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Ghost Field Injection**: Adding `isAdmin: true` to a record.
2. **Invalid State Transition**: Setting `estado: 'invalid_status'`.
3. **ID Poisoning**: Creating record with 500-character malicious string ID.
4. **CreatedAt Tampering**: Updating `created_at` to a past or future date.
5. **ID Mutation**: Updating `id` to mismatch document path.
6. **Missing Required Fields**: Creating record without `egreso` object.
7. **Empty String ID**: Creating a record with empty string as id.
8. **Oversized Label**: Setting backup label longer than 200 characters.
9. **Negative Record Count**: Setting backup recordCount to -1.
10. **Type Poisoning**: Setting `estado` to a boolean or integer.
11. **Orphaned Write**: Updating document that doesn't exist without create path.
12. **Malicious Path Traversal**: Requesting access outside `/maintenance_records` or `/backups`.

## 3. Test Runner
Verified via security rules testing structure ensuring all malicious payloads receive `PERMISSION_DENIED`.
