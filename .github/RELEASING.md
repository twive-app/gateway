# Releasing

For maintainers: how a version of the gateway gets from `dev` to a GitHub release and a Docker image. Everything below is
what the workflows in [`workflows/`](workflows) do – `release.yaml`, `docker-publish.yml`, `build.yaml` and
`lint.yaml`, plus the composite action [`actions/stamp-version`](actions/stamp-version/action.yml).

- [1. Versioning](#1-versioning)
- [2. Branches](#2-branches)
- [3. Creating a release](#3-creating-a-release)
- [4. Prereleases](#4-prereleases)
- [5. Automatic builds without a release](#5-automatic-builds-without-a-release)
- [6. When something goes wrong](#6-when-something-goes-wrong)
- [7. Hotfix](#7-hotfix)
- [8. Once, before the first release](#8-once-before-the-first-release)
- [9. Checklist](#9-checklist)

## 1. Versioning

[SemVer](https://semver.org), tags `vX.Y.Z`; prereleases `vX.Y.Z-rc.N`, `vX.Y.Z-beta.N`, `vX.Y.Z-alpha.N`.

| Bump | When |
|---|---|
| **Major** | Breaking for apps or operators: a protocol change clients have to follow (new API version `v`, removed/renamed fields, opcodes or events, changed close code semantics), a removed or renamed environment variable, a changed default that changes behaviour, data in Redis that a downgrade can't read |
| **Minor** | Backwards compatible additions: new events, opcodes, fields or close codes, new optional environment variables, new endpoints |
| **Patch** | Fixes and internal changes without new behaviour for apps or operators (also dependency and base image updates) |

`package.json` always keeps `"version": "0.0.0-canary"` – the lint workflow fails otherwise. The release workflow
stamps the version from the tag ([`stamp-version`](actions/stamp-version/action.yml) replaces exactly
`"version": "0.0.0-canary",` and fails if that string isn't there).

## 2. Branches

Development happens on `dev`, releases are cut from `main`:

1. Open a pull request `dev` → `main`.
2. Wait for the checks: *Lint* (typecheck, ESLint, canary version, commit messages) and *Build* (both binaries compiled and
   smoke-tested against Redis).
3. Merge with a normal merge commit.

Every push to `main` also builds the Docker image `main` (see [section 5](#5-automatic-builds-without-a-release)).

## 3. Creating a release

1. **Tag `main`:**

   ```bash
   git switch main && git pull
   git tag -a v1.2.3 -m "v1.2.3"
   git push origin v1.2.3
   ```

2. **The *Release* workflow runs** (`release.yaml`, on every pushed tag `v*`):
   1. `bun install --frozen-lockfile` and `bun run typecheck`.
   2. Stamps the version of the tag into `package.json`.
   3. Creates the branch `release/v1.2.3` from the tagged commit, pushes it and adds the commit
      `ci(release): bump version` with the stamped `package.json`. The tag itself keeps pointing to the commit on
      `main` (with `0.0.0-canary`).
   4. Compiles `gateway-linux-x64` (`bun-linux-x64-baseline`) and `gateway-linux-arm64` with the stamped version and
      checks that `./gateway-linux-x64 --version` prints `1.2.3`.
   5. Writes `checksum.txt` (SHA-256 of both binaries).
   6. Creates a **draft** release for the tag with the three files – marked as prerelease if the tag contains `rc`,
      `beta` or `alpha`.

3. **Review the draft** under *Releases*: the files are attached, the prerelease flag is right. Write the release notes
   – *Generate release notes* gives you the merged pull requests; group them into *Features* (`feat`) and *Fixes*
   (`fix`) and call out anything breaking or any new environment variable.

4. **Publish** the draft. The *docker-publisher* workflow (`docker-publish.yml`, `release: published`) checks out the
   tag, stamps the version and builds the image for `linux/amd64` and `linux/arm64` with the tags
   - `v1.2.3`, and
   - `latest` – only if the release is not marked as prerelease.

5. **Verify:**

   ```bash
   docker run --rm ghcr.io/twive-app/gateway:v1.2.3 --version    # 1.2.3
   docker run --rm ghcr.io/twive-app/gateway:latest --version    # 1.2.3 (not for prereleases)
   ```

   and download a binary from the release: `sha256sum --check --ignore-missing checksum.txt`,
   `./gateway-linux-x64 --version`.

## 4. Prereleases

The workflows recognise a prerelease by `rc`, `beta` or `alpha` anywhere in the tag (`release.yaml` sets the prerelease
flag of the draft from it). `docker-publish.yml` follows the flag of the published release: a prerelease gets its own
tag (e.g. `v1.3.0-rc.1`) and the channel tag `alpha`, `beta` or `rc` (from `-alpha`, `-beta`, `-rc` in the tag), so
testers can follow e.g. `ghcr.io/twive-app/gateway:beta` – never `latest`. The weekly rebuild
([section 5](#5-automatic-builds-without-a-release)) ignores prereleases – it rebuilds GitHub's *latest* release, and
the channel tags only move with the next prerelease of that channel.

## 5. Automatic builds without a release

| Trigger | Workflow | Result |
|---|---|---|
| Push to `main` / `dev` | `docker-publish.yml` | image `main` / `dev` with the version `main-<short sha>` / `dev-<short sha>` |
| Manual run (*Run workflow*) | `docker-publish.yml` | test image of any branch, see [Test images](#test-images) |
| Sundays 03:00 UTC | `cleanup-images.yaml` | old test images and unreferenced untagged versions removed, see [Cleanup](#cleanup) |
| Push to `main` / `dev`, pull requests | `build.yaml` | both binaries compiled and smoke-tested (`--version`, start, healthcheck, SIGTERM), uploaded as workflow artifacts |
| Push to `main` / `dev`, pull requests | `lint.yaml` | typecheck, ESLint, canary version; for pull requests also every commit message (commitlint) |
| Mondays 00:00 UTC | `docker-publish.yml` | the latest (non-prerelease) release rebuilt with fresh base images: tags `vX.Y.Z` and `latest` |

`skip docker` or `docker skip` in the message of the head commit of a push to `main` or `dev` skips the image build.
Releases, the weekly rebuild and manual runs always build.

### Test images

To try a branch in a real deployment before it is merged: *Actions* → *docker-publisher* → *Run workflow*, pick the
branch and optionally an image tag. Without a tag the image is called `test-<branch>` (lower case, other characters
replaced by `-`, e.g. `feature/Login` → `test-feature-login`); the reserved tags `latest`, `main`, `dev`, `alpha`,
`beta`, `rc` and `v*` are rejected. The version in the start log and `/health` is `test-<short sha>`. Or with the
GitHub CLI:

```bash
gh workflow run docker-publish.yml --ref feature/login -f tag=test-login
docker run --rm ghcr.io/twive-app/gateway:test-login --version     # test-<short sha>
```

Running it again with the same tag overwrites the image. Test images are removed automatically 30 days after their
last push, see [Cleanup](#cleanup).

### Cleanup

`cleanup-images.yaml` runs every Sunday at 03:00 UTC and removes from GHCR:

- test images (all tags start with `test-`) whose last push is older than 30 days,
- untagged versions older than 30 days that no remaining image references – earlier builds of `main` and `dev`,
  re-pushed test tags, the images replaced by the weekly release rebuild and the platform manifests of removed test
  images.

Everything that still has another tag (releases, `latest`, `alpha`/`beta`/`rc`, `main`, `dev`, newer test images)
stays, including every manifest it references. Images pulled **by digest** (`…@sha256:…`) of an old build stop working
after 30 days – pin release tags instead.

Run it by hand under *Actions* → *Cleanup images* → *Run workflow* with a different age (`days`) or as a dry run
(`dry_run`), which only lists what would be removed:

```bash
gh workflow run cleanup-images.yaml -f days=7 -f dry_run=true
```

Deleting needs the **Admin** role of this repository on the package: organisation → Packages → `gateway` → *Package
settings* → *Manage Actions access*. If the run fails with `403`, add the repository there with the role *Admin*.

## 6. When something goes wrong

**The *Release* workflow failed** (or produced a broken draft): fix the cause on `main`, then remove everything the run
created and tag again:

```bash
gh release delete v1.2.3 --yes              # the draft, if it was created
git push origin --delete release/v1.2.3     # the release branch, if it was pushed
git push origin --delete v1.2.3             # the remote tag
git tag -d v1.2.3                           # the local tag

git switch main && git pull
git tag -a v1.2.3 -m "v1.2.3"
git push origin v1.2.3
```

**The image build failed after publishing:** fix the cause, then re-run the failed *docker-publisher* run from the
Actions tab (it builds the tag of the release again).

**A published release is broken:** never overwrite it – don't move the tag, don't replace the files. Release a patch
version (`v1.2.4`) with the fix.

## 7. Hotfix

1. Fix via a pull request into `main` – directly, or through `dev` → `main` if `dev` has nothing that shouldn't be
   released yet.
2. Merge `main` back into `dev` (pull request `main` → `dev`) so the fix isn't lost.
3. Tag the patch version on `main` as in [section 3](#3-creating-a-release).

## 8. Once, before the first release

- **Make the package public:** after the first image push, GitHub → organisation → *Packages* → `gateway` → *Package
  settings* → *Change visibility* → *Public*. Otherwise `docker pull` needs a login.
- **Tag ruleset:** *Settings → Rules → Rulesets → New tag ruleset* for `v*` that restricts creations, updates and
  deletions, with maintainers as the only bypass – only they can start a release.
- **Branch rules:** the *Release* workflow pushes `release/*` branches with the `GITHUB_TOKEN`; rulesets on other
  branches must not block that. Require the checks *Typecheck & ESLint*, *Commit messages* and *Compile x64/arm64* for
  `dev` and `main`.

## 9. Checklist

- [ ] Pull request `dev` → `main` merged, all checks green
- [ ] `main` pulled locally, tag `vX.Y.Z` created and pushed
- [ ] *Release* workflow green, branch `release/vX.Y.Z` exists
- [ ] Draft has `gateway-linux-x64`, `gateway-linux-arm64`, `checksum.txt`; prerelease flag correct
- [ ] Release notes written (features, fixes, breaking changes, new variables)
- [ ] Draft published
- [ ] *docker-publisher* workflow green
- [ ] `docker run --rm ghcr.io/twive-app/gateway:vX.Y.Z --version` prints the version (and `latest` for a stable release)
- [ ] Binary from the release: checksum ok, `--version` prints the version
- [ ] Hotfix only: `main` merged back into `dev`
