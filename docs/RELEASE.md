# Release process

Two long-lived branches, two npm majors. See [ADR-0005](./adr/0005-sdk-lane-versioning.md).

| Branch | npm major | npm dist-tag | Expo SDK | iOS min | Status |
| --- | --- | --- | --- | --- | --- |
| **`main`** | `2.x` | `latest` (default) | 56+ | 16.4 | Active development; default for new work |
| **`v1`** | `1.x` | `sdk55` | 55 | 15.1 | Maintenance; bugfixes and security backports |

---

## Releasing `2.x` from `main` (Expo SDK 56)

Default path for new features and fixes on the SDK 56 lane.

### Pre-release

Follow [QA_CHECKLIST.md](./QA_CHECKLIST.md) on the **SDK 56** toolchain (`main` checkout, `example/` on SDK 56).

- [ ] `yarn typecheck` and `yarn lint` pass on `main`
- [ ] `yarn build` → `build/` and `yarn build:plugin` → `plugin/build/`
- [ ] README and CHANGELOG on `main` reflect the SDK 56 / `2.x` lane

### Publish

Releases are automated via [Release Please](https://github.com/googleapis/release-please) on **`main`**:

1. Merge conventional commits to `main`.
2. Release Please opens/updates a release PR (e.g. `chore(main): release expo-spotify-sdk 2.0.0`).
3. Merge that PR → GitHub Release + **npm publish** (`.github/workflows/release.yml` runs `yarn prepublishOnly` — which fetches Spotify SDK binaries from GitHub, builds TypeScript, and verifies the npm tarball includes them — then `npm publish`).

See [guides/native-sdk-distribution.md](./guides/native-sdk-distribution.md).

No manual `npm publish` unless automation is broken.

### Post-release

- [ ] GitHub Release notes mention **Expo SDK 56** and link to [ADR-0005](./adr/0005-sdk-lane-versioning.md)
- [ ] npm `latest` points at the new `2.x` (verify on https://www.npmjs.com/package/@wwdrew/expo-spotify-sdk)

---

## Releasing `1.x` from `v1` (Expo SDK 55)

For consumers who cannot move to Expo SDK 56 yet.

### Branch

`v1` is pinned at the **`expo-spotify-sdk-v1.0.0`** tag (`d144507`) — the last commit before SDK 56 landed on `main`. Do **not** cut `v1` from current `main`.

```sh
git fetch origin
git checkout v1
git pull origin v1
```

### Pre-release

Follow [QA_CHECKLIST.md](./QA_CHECKLIST.md) on the **SDK 55** toolchain (`v1` checkout; example app on SDK 55).

- [ ] `yarn` / build / test pass on `v1` (see `package.json` scripts on that branch)
- [ ] Changes are backported intentionally — `main` is not merged wholesale into `v1`

### Publish

Releases are automated via [Release Please](https://github.com/googleapis/release-please) on **`v1`** (same workflow as `main`, scoped with `target-branch`):

1. Cherry-pick or land conventional commits on `v1` (`fix:`, `feat:`, etc.).
2. Release Please opens/updates a release PR on `v1` (e.g. `chore(v1): release expo-spotify-sdk 1.0.1`).
3. Merge that PR → GitHub Release + **npm publish** with dist-tag **`sdk55`** (not `latest`).

Install for consumers:

```sh
npm install @wwdrew/expo-spotify-sdk@1
# or explicitly:
npm install @wwdrew/expo-spotify-sdk@sdk55
```

`1.0.0` is already on npm from the initial SDK 55 release (git tag `expo-spotify-sdk-v1.0.0`).

#### One-time setup

1. **Workflow on `v1`** — GitHub Actions runs the workflow file **from the branch that was pushed**. Merge `.github/workflows/release.yml` into **`v1`** (cherry-pick from `main`) before the first automated `1.x.y` release. Until then, pushes to `v1` will not trigger Release Please.

2. **`sdk55` dist-tag on `1.0.0`** (if not already set):

   ```sh
   npm dist-tag add @wwdrew/expo-spotify-sdk@1.0.0 sdk55
   ```

### Post-release

- [ ] GitHub Release notes mention **Expo SDK 55**
- [ ] npm **`latest`** still points at the current **`2.x`** (a mistaken `v1` publish without `--tag sdk55` would steal `latest` — fix with `npm dist-tag add @wwdrew/expo-spotify-sdk@<2.x> latest`)
- [ ] README on `v1` (if branched docs differ) still directs SDK 56 consumers to `2.x` on `main`

---

## Porting fixes between lanes

| Direction | Guidance |
| --- | --- |
| `main` → `v1` | Cherry-pick only when the fix applies to SDK 55 / does not depend on SDK 56 APIs (e.g. typed config plugin). |
| `v1` → `main` | Cherry-pick when the bug exists on both lanes. |

Feature work lands on **`main` first**; backport to `v1` at maintainer discretion.
