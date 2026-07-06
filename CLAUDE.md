At the end of each task, check whether you need to update the documentation with
the latest information to keep it up to date.

When you finish your work, provide a proposed commit message (never commit
automatically). Also update the CLI version to the most appropriate one based on
the current version in the `package.json` file, without committing, and keep the
`CHANGELOG.md` up to date. Before changing the version, check the latest
published one here https://www.npmjs.com/package/@ndnci/translify to not
increment a not published version during development. For example if on NPM
latest version is 0.5.0 and in the code the version is 0.6.0 it means this
version is not published yet, so fine to keep it, except if the new changes are
major etc.

If possible, do not modify staged changes or run any `git stash`.
