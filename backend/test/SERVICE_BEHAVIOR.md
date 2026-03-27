# Service Behavior Contracts

This document defines expected service behavior verified by unit/contract tests.
These tests focus on outcomes and invariants, not implementation details.

## AuthService
- Rejects access for locked accounts.
- Enforces tenant-aware login/validation.
- Rotates and stores token-related state through Redis flows.

## AlertsService
- Prevents duplicate open alerts for same patient/type.
- Enforces valid forward-only status transitions.
- Uses tenant-scoped and race-safe status updates.

## DashboardService
- Computes KPI aggregates for tenant-scoped data.
- Returns alert/message/patient metrics with expected counting semantics.

## ComorbiditiesService
- Derives risk flags from comorbidity type.
- Rejects cross-tenant access.
- Uses tenant-scoped update/delete writes.

## MedicationsService
- Derives clinical flags from medication category.
- Rejects cross-tenant access.
- Uses tenant-scoped update/delete writes.

## PerformanceStatusService
- Persists performance-history entries.
- Synchronizes latest ECOG into patient record.
- Returns null delta when history is insufficient.

## ScheduledActionsService
- Rejects past-dated scheduling.
- Disallows cancellation of terminal statuses.
- Uses tenant-scoped cancel writes.

## MessagesService
- Rejects patient or conversation access outside tenant scope.
- Emits channel events by message direction.
- Triggers agent pipeline for inbound text (non-blocking).
- Supports bulk assumption behavior without unnecessary writes.

## ObservationsService
- Rejects create/update when patient or linked message is out-of-scope.
- Triggers priority recalculation after creation.
- Uses tenant-scoped sync/update/delete behavior.

## TreatmentsService
- Requires diagnosis to exist within tenant before create.
- Defaults lifecycle fields on create when omitted.
- Uses tenant-scoped update/delete writes.

## UsersService
- Enforces unique email per tenant.
- Restricts non-admin role creation/role changes.
- Hashes passwords before persistence.
- Prevents deletion of last tenant admin.

## InternalNotesService
- Requires patient ownership on create.
- Enforces author/admin authorization on update/delete.
- Uses tenant-scoped write operations.

## ClinicalProtocolsService
- Looks up active protocol per tenant/cancer type.
- Normalizes cancer type keys.
- Initializes defaults idempotently when already present.

## PriorityRecalculationService
- Returns false when patient is missing or AI call fails.
- Maps AI response to normalized category/score.
- Persists priority via tenant-scoped updates.

## DecisionGateService
- Classifies actions into auto-approved vs approval-required buckets.
- Rejects duplicate approvals/rejections.
- Uses tenant-scoped decision approval/rejection writes.
