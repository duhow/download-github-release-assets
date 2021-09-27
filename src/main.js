const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');

// const glob = require('@actions/glob')

const token = core.getInput('token');
const octokit = github.getOctokit(token);

function regExpEscape(s) { return s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'); }
function wildcardToRegExp(s) { return new RegExp(`^${s.split(/\*+/).map(regExpEscape).join('.*')}$`); }

async function run() {
  try {
    const repoString = core.getInput('repo') || core.getInput('repository');
    if (!repoString) {
      core.setFailed('Repository variable empty or not defined.');
    }
    const [owner, repo] = repoString.split('/');
    core.info(`Using GitHub repository: ${owner}/${repo}`);

    let tag = core.getInput('tag') || core.getInput('version');
    const releaseId = core.getInput('release-id');
    const filesString = core.getInput('file') || core.getInput('files');
    if (!filesString) {
      core.setFailed('File selector empty or not defined.');
    }
    const selectorFiles = filesString.split('\n');

    const prefixTagsClean = ['refs/', 'tags/'];
    for (const prefix of prefixTagsClean) {
      if (tag.startsWith(prefix)) {
        tag = tag.slice(prefix.length);
        core.debug(`Truncated tag to ${tag}`);
      }
    }

    let release = null;
    if (tag) {
      core.info(`Getting release by tag: ${tag}`);
      release = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
    } else if (!Number.isNaN(releaseId)) { // is numeric
      core.info(`Getting release ID: ${releaseId}`);
      release = await octokit.rest.repos.getRelease({ owner, repo, releaseId });
    } else if (!releaseId || releaseId === 'latest') {
      core.info('Getting latest release');
      release = await octokit.rest.repos.getLatestRelease({ owner, repo });
    } else {
      core.setFailed('No valid tag or release ID provided.');
    }

    if (!release || !release.data) {
      core.setFailed('Release does not exist or is unaccessible.');
    }

    core.info(`${release.data.assets.length} assets available.`);

    core.debug(JSON.stringify(release));
    core.setOutput('name', release.data.name);
    core.setOutput('body', release.data.body);
    core.setOutput('tag', release.data.tag_name);

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

    const download = (core.getInput('download') !== 'false');

    const target = core.getInput('target');
    let folder = target;

    if (target) {
      let createFolder = false;

      // Extract filename from target path and get folders only
      if (assets.length === 1 && target.includes('/')) {
        createFolder = true;

        folder = target.split('/');
        folder.pop(); // remove filename
        folder = folder.join('/');
      } else if (assets.length > 1 || selectorFiles[0] === '*') {
        createFolder = true;
      }

      if (!fs.existsSync(folder) && createFolder && download) {
        core.info(`Creating folder ${folder}`);
        fs.mkdirSync(folder, { recursive: true });
      }
    }

    let createdAssets = [];

    assets.forEach(async (asset) => {
      let filename = asset.name;
      let msg = '';
      if (!download) {
        msg += '*NOT* ';
      }
      msg += `Downloading ${asset.name} with ${asset.size} bytes`;
      if (target) {
        filename = (assets.length === 1 && !target.endsWith('/') ? target : `${folder}/${asset.name}`);
        filename = filename.replace('//', '/');
        msg += ` to ${filename}`;
      }
      createdAssets.push(filename);
      core.info(msg);

      if (!download) { return; }

      const file = fs.createWriteStream(filename);
      const response = await octokit.rest.repos.getReleaseAsset({
        headers: { Accept: 'application/octet-stream' },
        owner,
        repo,
        asset_id: asset.id,
      });
      core.debug(response);
      file.write(Buffer.from(response.data));
      file.end();
    });
    await core.setOutput('assets', createdAssets);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
