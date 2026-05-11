# pnpm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the `frontend/` directory from `npm` to `pnpm` to improve performance and reliability.

**Architecture:** Clean-slate migration involving the removal of legacy `package-lock.json` and `node_modules/`, followed by a fresh `pnpm install`.

**Tech Stack:** pnpm, Expo (Metro), React Native.

---

### Task 1: Environment Cleanup

**Files:**
- Modify: `frontend/` (delete files/folders)

- [x] **Step 1: Remove existing npm lockfile**

Run: `rm frontend/package-lock.json`

- [x] **Step 2: Remove existing node_modules**

Run: `rm -rf frontend/node_modules/`

- [x] **Step 3: Commit cleanup**

```bash
git add frontend/package-lock.json
git commit -m "chore: remove npm lockfile and node_modules for pnpm migration"
```

---

### Task 2: Fresh Install with pnpm

**Files:**
- Create: `frontend/pnpm-lock.yaml`

- [ ] **Step 1: Perform fresh installation**

Run: `cd frontend && pnpm install`
Expected: `pnpm-lock.yaml` is generated and dependencies are installed.

- [ ] **Step 2: Verify lockfile existence**

Run: `ls frontend/pnpm-lock.yaml`
Expected: File exists.

- [ ] **Step 3: Commit new lockfile**

```bash
git add frontend/pnpm-lock.yaml
git commit -m "chore: initialize pnpm lockfile"
```

---

### Task 3: Regression Testing

**Files:**
- Modify: N/A (Verification task)

- [ ] **Step 1: Run Jest tests via pnpm**

Run: `cd frontend && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Start Expo development server**

Run: `cd frontend && pnpm start`
Expected: Expo initializes, and Metro bundler starts without resolution errors. (Note: You can stop the server after it successfully initializes).

---

### Task 4: Optional Metro Compatibility Fix (If Task 3 fails)

**Files:**
- Create: `frontend/.npmrc`

- [ ] **Step 1: Add .npmrc for hoisting if bundler fails**

If `pnpm start` failed with module resolution errors in Task 3, create `frontend/.npmrc` with the following content:

```ini
node-linker=hoisted
```

- [ ] **Step 2: Re-install dependencies**

Run: `cd frontend && pnpm install`

- [ ] **Step 3: Verify fix**

Run: `cd frontend && pnpm start`

- [ ] **Step 4: Commit .npmrc**

```bash
git add frontend/.npmrc
git commit -m "fix: add .npmrc with hoisted linker for Metro compatibility"
```
