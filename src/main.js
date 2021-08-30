const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');
// const glob = require('@actions/glob')

const token = core.getInput('token');
const octokit = github.getOctokit(token);
const { context } = github;

async function run() {
  let repository = core.getInput('repository');
  if (!repository) { repository = '{context.repo.owner}/{context.repo.repo}'; }
  core.info(`Using GitHub repository: ${repository}`);

  const [owner, repo] = repository.split('/');
  core.debug(`owner: ${owner}, repo: ${repo}.`);

  const tag = core.getInput('tag');
  const releaseId = core.getInput('release-id');
  const selectorFiles = core.getInput('files').split('\n');

  let release = null;
  if (tag) {
    core.info(`Getting release by tag: ${tag}`);
    release = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
  } else if (releaseId && releaseId === 'latest') {
    core.info('Getting latest release');
    release = await octokit.rest.repos.getLatestRelease({ owner, repo });
  } else if (releaseId) {
    core.info(`Getting release ID: ${releaseId}`);
    release = await octokit.rest.repos.getRelease({ owner, repo, releaseId });
  } else {
    core.setFailed('No valid tag or release ID provided.');
  }

  if (!release || !release.data) {
    core.setFailed('Release does not exist or is unaccessible.');
  }

  core.info(`${release.data.assets.length} assets available.`)

  core.debug(JSON.stringify(release))

  if(selectorFiles.length == 1 && selectorFiles[0] === '*'){
    core.info('Downloading all assets available')
    for(const asset of release.data.assets){
      core.info(`Downloading ${asset.name} with ${asset.size} bytes`)
      const file = fs.createWriteStream(asset.name);
      const buffer = await octokit.rest.repos.getReleaseAsset({
        headers: {Accept: 'application/octet-stream'},
        owner: owner,
        repo: repo,
        asset_id: asset.id,
      });
      file.write(buffer.data);
      file.end();
    }
  }

}

run();
