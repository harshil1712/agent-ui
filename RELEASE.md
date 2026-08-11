# Releasing Agent UI

Releases use Changesets and the `Release` GitHub Actions workflow.

## First release

1. Create an npm access token for the `harshil1712` account with permission to publish public
   packages, then add it to the GitHub repository as the `NPM_TOKEN` Actions secret.
2. In GitHub under **Settings → Actions → General**, enable **Allow GitHub Actions to create and
   approve pull requests**.
3. Push a changeset to `main`. The release workflow opens a version PR that changes the package
   from `0.0.0` to `0.1.0` and creates its changelog.
4. Merge the version PR. The next workflow run builds and publishes `@harshil1712/agent-ui` with
   npm provenance.

The initial workflow uses `NPM_TOKEN` because npm trusted publishing can only be configured after
the package exists. Keep the token until the release workflow is explicitly migrated to direct
OIDC publishing; removing it while using `changesets/action@v1` will prevent publishing.
