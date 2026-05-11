# Design: Migrating Frontend to pnpm

**Date:** 2026-05-11
**Status:** Approved

## Purpose
The project's frontend is currently using `npm`. To improve installation speed, disk usage, and dependency management reliability, we are migrating the `frontend/` directory to use `pnpm`.

## Current State
- **Path:** `frontend/`
- **Framework:** Expo v50 (React Native)
- **Current Manager:** npm (with `package-lock.json`)

## Architecture & Implementation
The migration follows a "Clean Slate" approach to ensure `pnpm` generates an optimal and unpolluted dependency tree.

### 1. Cleanup
- Removal of `frontend/package-lock.json`.
- Removal of `frontend/node_modules/`.

### 2. Dependency Resolution
- Installation using `pnpm install` in the `frontend/` directory.
- **Contingency:** If the Metro bundler encounters module resolution issues due to `pnpm`'s content-addressable storage (symlinking), we will apply a `.npmrc` configuration:
  ```ini
  node-linker=hoisted
  ```
  This retains the "flat" structure Metro expects while using `pnpm` for its performance benefits.

### 3. Workflow Changes
- Developers should use `pnpm` for all frontend package operations (`pnpm add`, `pnpm run`, etc.).
- CI/CD pipelines (if applicable) should be updated to use `pnpm`.

## Success Criteria
1. Successful generation of `frontend/pnpm-lock.yaml`.
2. `pnpm test` (Jest) passes within the frontend directory.
3. `pnpm start` initializes the Expo development server and Metro bundler without resolution errors.

## Verification Plan
- **Pre-Implementation:** Verify `pnpm` version and environment suitability.
- **Implementation:** Monitor the install process for errors or peer dependency warnings.
- **Post-Implementation:** Execute the success criteria tests.
