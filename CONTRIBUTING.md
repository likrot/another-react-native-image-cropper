# Contributing

Contributions of any size are welcome. Please be friendly and respectful — see the [code of conduct](./CODE_OF_CONDUCT.md).

## Project layout

This is a Yarn 4 monorepo with two packages:

- The library at the repo root.
- A bare React Native demo app at [`example/`](./example/).

The example consumes the library via a workspace link, so any change you make in `src/` is picked up by the demo app on the next Metro reload — no rebuild needed (the library is JS/TypeScript only; we delegate the actual pixel crop to `@react-native-community/image-editor`, which is a peer dependency).

## Setup

Make sure you have the Node version pinned in [`.nvmrc`](./.nvmrc), then:

```sh
yarn install
```

Yarn 4 is bundled in the repo via Corepack — running `yarn` will use the exact CLI committed to `.yarn/releases/`. **Don't use `npm`** for development; the workspace setup expects Yarn.

## Running the example

```sh
yarn example pods           # iOS only, first run
yarn example ios            # or: yarn example android
yarn example start          # if the packager isn't already running
```

## Local checks

Each of these matches a CI gate. Run them locally before opening a PR:

```sh
yarn typecheck       # tsc
yarn lint            # eslint (use `yarn lint --fix` to auto-fix)
yarn format:check    # prettier check (use `yarn prettier --write '**/*.{ts,tsx}'` to fix)
yarn test            # jest (65 tests across cropMath, IconPicker, mergeTheme, ImageCropperModal)
yarn prepare         # react-native-builder-bob → emits lib/module + lib/typescript
```

## Git hooks (lefthook)

Hooks run automatically and you should not bypass them with `--no-verify` unless you know exactly what you're doing.

| Hook | What runs | When |
|---|---|---|
| `commit-msg` | commitlint (Conventional Commits) | Every commit |
| `pre-commit` | strip-dev-team (on `*.pbxproj`), typecheck, prettier auto-format | Every commit |
| `pre-push` | jest | Every push |

### Commit message format

Commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/). The valid types are: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `revert`. Examples:

```
feat: add square-dashed icon to bundled set
fix: clamp aspect-locked drag to MIN_RECT_SIZE
docs: clarify icons prop stability requirement
```

Subject must not be empty. `release-it` derives the changelog from these — `feat:` and `fix:` commits show up in release notes; `chore:` and `docs:` do not.

## Adding a built-in shape or toolbar icon

Built-in icons and shape masks are SVG path strings in `src/constants/icons.ts`, copied verbatim from [Lucide](https://lucide.dev) (ISC). When adding a new one:

1. Pull the path from lucide.dev (24×24 viewBox) and add it to `ICON_PATHS` with a `// lucide.dev/icons/<name> — ISC` comment for traceability.
2. Add the new id to the `IconName` type in the same file.
3. If it's a new shape, add a `Shape` entry to `src/shapes/builtins.ts` and re-export from `src/index.ts`.

Lucide is already covered by [`NOTICE`](./NOTICE) — no additional attribution needed for icons sourced from it.

## Tests

New behavior should land with a test. Unit tests for pure logic (geometry, theme merge) follow [`cropMath.test.ts`](./src/__tests__/cropMath.test.ts); integration tests for component behavior follow [`ImageCropperModal.test.tsx`](./src/__tests__/ImageCropperModal.test.tsx).

Reanimated 4 + worklets are wired up via the **canonical Software Mansion setup** — no manual mocks:

- `package.json` jest config sets `"resolver": "react-native-worklets/jest/resolver"`, which swaps the native worklets module for its web implementation.
- `jest.setup.ts` calls `require('react-native-reanimated').setUpTests()`, which registers reanimated's own jest mocks.
- `babel.config.js` applies `react-native-worklets/plugin` only when `BABEL_ENV=test` so jest can transform `'worklet'` directives and `useAnimatedStyle` dependency tracking. The plugin is **not** baked into the bob-built output — consumers apply it themselves in their app's babel config.

If a test needs to render something animation-heavy, you generally don't need to add anything to `jest.setup.ts` — reanimated's web implementation handles it. The one extra mock we keep is `react-native-safe-area-context` (returns zero insets and renders providers as passthrough), because its native module isn't available under jest.

## Supply-chain hardening

`.yarnrc.yml` ships with these defaults:

- **`enableScripts: false`** — blocks all package install-time lifecycle scripts (postinstall etc.). Mitigates the most common npm supply-chain attack vector. Packages that legitimately need install scripts must be opted-in via `dependenciesMeta.<pkg>.built = true` in `package.json` (currently: only `@evilmartians/lefthook`).
- **`enableHardenedMode: true`** — verifies downloaded package contents against lockfile hashes; catches tampered registry mirrors.
- **`enableTelemetry: false`** — opt out of Yarn telemetry.

If you add a new dependency that needs to run install scripts (e.g., compiles a native binary), the install will fail. Either confirm the package is trustworthy and add it to `dependenciesMeta`, or pick a no-scripts alternative.

## Releases (maintainers)

```sh
./cleanup.sh                 # pre-publish sanity check (also runs automatically as a release-it hook)
yarn release --dry-run       # preview the bump + changelog + tag without publishing
yarn release                 # actually publish: bump, tag, push, npm publish, GitHub release
```

`release-it` reads conventional-commit messages since the last tag to derive the version bump and changelog entries.

## Pull requests

- Keep PRs focused on one change.
- Make sure local checks are green before opening.
- For changes that touch the public API (`ImageCropperModalProps`, `Shape` protocol, exported types), open an issue first to align on the API shape — pre-1.0 we still break things freely, but breaking changes deserve a discussion.

> **First PR ever?** [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github) is a free walkthrough.
