# Releasing Agent UI

Releases use Changesets, npm trusted publishing, and the `Release` GitHub Actions workflow.

## Setup

The npm trusted publisher for `@harshil1712/agent-ui` must allow `npm publish` from:

- GitHub user: `harshil1712`
- Repository: `agent-ui`
- Workflow: `release.yml`

In GitHub under **Settings → Actions → General**, enable **Allow GitHub Actions to create and
approve pull requests**. The workflow uses GitHub OIDC and does not require an `NPM_TOKEN` secret.

## Publish a release

1. Run `pnpm changeset` and describe the user-facing change.
2. Commit the generated changeset and merge it into `main`.
3. The release workflow opens or updates the **Version Packages** pull request.
4. Merge that pull request. The next workflow run publishes the new package version with npm
   provenance and creates the corresponding GitHub release.
