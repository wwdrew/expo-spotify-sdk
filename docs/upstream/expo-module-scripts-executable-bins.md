# Upstream issue: `expo-module-scripts` subcommand bins not executable on install

Filed as [expo/expo#46404](https://github.com/expo/expo/issues/46404).

---

## Title

`expo-module-scripts`: subcommand bin files not executable in published tarball (EACCES on `yarn install` / `prepare`)

## Description

### Summary

On a clean Linux install, packages that use the recommended `expo-module-scripts` lifecycle scripts fail when `prepare` runs `expo-module prepare`:

```text
Error: '.../node_modules/expo-module-scripts/bin/expo-module-prepare' not executable
```

The same `EACCES` affects `expo-module build`, `lint`, `test`, etc., because Commander spawns extensionless subcommand files directly.

### Steps to reproduce

```sh
mkdir repro && cd repro
cat > package.json <<'EOF'
{
  "name": "repro",
  "private": true,
  "scripts": { "prepare": "expo-module prepare" },
  "devDependencies": { "expo-module-scripts": "56.0.2" }
}
EOF
yarn install   # or: npm install
```

On Ubuntu / GitHub Actions (Node 20+), install exits with the error above.

### Expected behavior

`prepare` (noop in recent versions) completes; other `expo-module` subcommands run without requiring consumers to `chmod +x`.

### Actual behavior

Commander tries to `spawn('.../bin/expo-module-prepare')` but the file is mode `644` in `node_modules` after install.

### Root cause (as far as we can tell)

1. `package.json` only lists `"bin": { "expo-module": "bin/expo-module.js" }`.
2. Subcommands (`expo-module-prepare`, `expo-module-build`, …) live in `bin/` but are not in `bin` and have **no file extension**.
3. `npm pack` / registry tarball: only `expo-module.js` is `755`; subcommands are `644` (`tar -tvf` on `expo-module-scripts-56.0.2.tgz`).
4. Commander 12 uses `node` only for paths ending in `.js`, `.ts`, etc.; extensionless paths use `spawn(path)` and need `+x`.

Source repo has `publishConfig.executableFiles`, but the published npm package we inspected does not ship subcommands as executable.

### Suggested fixes (any one)

- Add subcommand paths to `bin`, **or**
- Rename subcommands to `expo-module-prepare.js` (etc.) so Commander uses `node`, **or**
- In `utils/commandUtils.js`, spawn with `process.execPath` when the target is not executable, **or**
- Ensure npm publish marks `publishConfig.executableFiles` entries as `755` in the tarball.

### Environment

- `expo-module-scripts@56.0.2`
- Node 24.x on `ubuntu-latest` (GitHub Actions)
- Yarn 1.22.x / npm 10.x

### Workaround (consumers)

Avoid the `expo-module` CLI in `package.json` scripts; call `tsc`, `eslint`, `jest` directly, and drop `prepare` (noop in v56). See consumer ADR: https://github.com/wwdrew/expo-spotify-sdk/blob/main/docs/adr/0007-bypass-expo-module-cli.md
