[![GitHub release](https://img.shields.io/github/release/duhow/download-github-release-assets.svg?style=flat-square)](https://github.com/duhow/download-github-release-assets/releases/latest)
[![Test workflow](https://img.shields.io/github/workflow/status/duhow/download-github-release-assets/ci?label=test&logo=github&style=flat-square)](https://github.com/duhow/download-github-release-assets/actions?workflow=ci)

# GitHub Action: Download GitHub Release Assets

Inspired by [dsaltares/fetch-gh-release-asset](https://github.com/dsaltares/fetch-gh-release-asset) GitHub Action and several others,
this action downloads all assets from a Release, without needing to build a Docker container.

This results in a faster job execution, since GitHub Actions Runner will execute the JavaScript code directly. :)

## Example

```yaml
name: ci

on:
  push:
    branches:
      - 'master'
    tags:
      - 'v*'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Download release dependencies
        uses: duhow/download-github-release-assets@v1
        with:
          token: ${{ secrets.PAT_TOKEN }}
          repository: actions/runner
          tag: v2.282.1
          files: actions-runner-linux-x64-*.tar.gz
          target: apps/actions-runner.tar.gz
      - name: Extract
        run: |
          tar xzvf apps/actions-runner.tar.gz
```

## Inputs

### `token`

**Optional** GitHub Token to authenticate as. Defaults to `${{ secrets.GITHUB_TOKEN }}`

### `repository`

The `org/repo` containing the release. Defaults to the current repository.

### `release-id`

The Release ID version to fetch. If no `tag` is specified, defaults to `latest` release.

### `tag`

The Git tag name to fetch the release from.

### `files`

**Required** The name of the file/s to download as a list, or single file.
If `files` is set to `'*'`, **all assets** are downloaded.  
You can use `*` wildcard to select a file pattern.

```yaml
files: |
  config.json
  program-*.exe
```

### `target`

Target file path. If several `files` are specified, this is the folder to download the files (recursive folders will be created if don't exist).
If `files` contains a single file, this is the full path to download the file (recursive folders will be created).

## Outputs

### `name`

The title / name of the selected release.

### `body`

The description / body of the selected release.

### `tag`

The Git tag value of the selected release. Useful to attempt knowing the version if you selected `latest`.

### `assets`

List of full path assets downloaded.
