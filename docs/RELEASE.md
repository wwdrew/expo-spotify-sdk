# Releasing v1.0.0 (Expo SDK 55 lane)

Follow after [QA_CHECKLIST.md](./QA_CHECKLIST.md) is signed off on `main` (SDK 55 toolchain).

## 1. Pre-release

- [ ] `yarn typecheck` and `yarn lint` pass
- [ ] `yarn build` produces `build/` and `yarn build:plugin` produces `plugin/build/`
- [ ] README, CHANGELOG, and coverage matrix in [V1_PLAN.md](./V1_PLAN.md) are current
- [ ] `package.json` version is `1.0.0`

## 2. Tag on `main`

```sh
git checkout main
git pull
git tag -a v1.0.0 -m "v1.0.0 — Expo SDK 55 lane: Auth + App Remote namespaces"
git push origin v1.0.0
```

Release to npm via your existing automation (e.g. GitHub Release + release-please) or:

```sh
npm publish --access public
```

## 3. Cut the `v1` maintenance branch

Immediately after the tag:

```sh
git branch v1 v1.0.0
git push -u origin v1
```

Configure **release-please** (or equivalent) so **`v1.x.y` releases publish from `v1`**, not `main`. `main` will later become the SDK 56 / `2.x` line ([Phase 7](./V1_PLAN.md#phase-7--migrate-main-to-expo-sdk-56-v200)).

## 4. Post-release

- [ ] GitHub Release notes mention **Expo SDK 55** and link to [ADR-0005](./adr/0005-sdk-lane-versioning.md)
- [ ] Example app README / npm keywords mention `v1.x` for SDK 55 consumers
