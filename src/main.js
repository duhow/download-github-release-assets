const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');

// const glob = require('@actions/glob')

const token = core.getInput('token');
const octokit = github.getOctokit(token);

function wildcardToRegExp(s) { return new RegExp(`^${s.split(/\*+/).map(regExpEscape).join('.*')}$`); }
function regExpEscape(s) { return s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'); }

async function run() {
  try {
    const [owner, repo] = core.getInput('repository', { required: true }).split('/');
    core.info(`Using GitHub repository: ${owner}/${repo}`);

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

    core.info(`${release.data.assets.length} assets available.`);

    core.debug(JSON.stringify(release));

    if (release.data.assets.length === 0) {
      core.warning('No assets available, exiting.');
      return;
    }

    let assets = [];

    if (selectorFiles.length === 1 && selectorFiles[0] === '*') {
      core.info('Downloading all assets available');
      assets = release.data.assets;
    } else {
      for (const asset of release.data.assets) {
        for (const name of selectorFiles) {
          const rexpr = wildcardToRegExp(name);
          if (asset.name.match(rexpr)) {
            assets.push(asset);
          }
        }
      }
      if (assets.length <= 0) {
        core.setFailed('No assets selected or available.');
      }
      core.info(`${assets.length} assets selected.`);
    }

    assets.forEach(async (asset) => {
      core.info(`Downloading ${asset.name} with ${asset.size} bytes`);
      const file = fs.createWriteStream(asset.name);
      const response = await octokit.rest.repos.getReleaseAsset({
        headers: { Accept: 'application/octet-stream' },
        owner,
        repo,
        asset_id: asset.id,
      });
      console.log(response);
      console.log(JSON.stringify(response));
      file.write(Buffer.from(response.data));
      file.end();
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
