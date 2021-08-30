const core = require('@actions/core');
const github = require('@actions/github');
// const glob = require('@actions/glob')

async function run() {
  const { context } = github;
  const token = core.getInput('token');
  let repository = core.getInput('repository');

  let octokit;
  try {
    octokit = github.getOctokit(token);
  } catch (error) {
    core.setFailed(error.message);
  }

  if (!repository) { repository = `{context.repo.owner}/{context.repo.repo}`; }
  core.info(`Using GitHub repository: ${repository}`);

  const owner = repository.split('/')[0];
  const repo = repository.split('/')[1];
  core.debug(`owner: ${owner}, repo: ${repo}.`)

  let release = null;
  const tag = core.getInput('tag');
  const releaseId = core.getInput('release-id');

  if (tag) {
    core.info(`Getting release by tag: ${tag}`);
    release = await octokit.rest.repos.getReleaseByTag(owner, repo, tag);
  } else if (releaseId && releaseId === 'latest') {
    core.info('Getting latest release');
    release = await octokit.rest.repos.getLatestRelease(owner, repo);
  } else if (releaseId) {
    core.info(`Getting release ID: ${releaseId}`);
    release = await octokit.rest.repos.getRelease(owner, repo, releaseId);
  } else {
    core.setFailed('No valid tag or release ID provided.');
  }

  if (!release) {
    core.setFailed('Release does not exist or is unaccessible.');
  }

  core.info(release);
}

run();
