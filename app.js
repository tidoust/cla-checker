import dotenv from 'dotenv';
import { Octokit, App } from 'octokit';
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { createNodeMiddleware } from '@octokit/webhooks';
import fs from 'node:fs';
import http from 'node:http';


/******************************************************************************
 * Check configuration parameters
 *****************************************************************************/
// Load environment variables from .env file if one is defined
dotenv.config({ quiet: true });

const appId = process.env.APP_ID;
if (!appId) {
  console.error('The APP_ID configuration parameter is missing.');
  console.error('See the README for details.');
  process.exit(1);
}

const privateKeyPath = process.env.PRIVATE_KEY_PATH ?? 'key.pem';
let privateKey;
try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
}
catch {
  console.error(`Could not find a private key to authenticate with the GitHub app at ${privateKeyPath}.`);
  console.error('Create the private key file and/or adjust the PRIVATE_KEY_PATH configuration parameter.');
  console.error('See the README for details.');
  process.exit(1);
}

const secret = process.env.WEBHOOK_SECRET;
if (!secret) {
  console.log(`The WEBHOOK_SECRET configuration parameter is missing.`);
  console.error('See the README for details.');
  process.exit(1);
}

const claRepo = process.env.CLA_REPOSITORY ?? 'w3c/cla-commitments';
const [claRepoOwner,claRepoName] = claRepo.split('/');
const claIssueTemplate = process.env.CLA_ISSUE_TEMPLATE ?? 'cla-commitment.yml';

const prAnchor = process.env.PR_ANCHOR ?? '### Pull request';

const prMessagePath = process.env.NEED_CLA_MESSAGE_PATH ?? 'need-cla-message.md';
let prMessage;
try {
  prMessage = fs.readFileSync(prMessagePath, 'utf8');
}
catch {
  console.error(`could not find a message to request a CLA commitment in ${prMessagePath}.`)
  console.error('Create the message file and/or adjust the CLA_MESSAGE_PATH configuration parameter.');
  console.error('See the README for details.');
  process.exit(1);
}


/******************************************************************************
 * Main server loop
 *****************************************************************************/
// Regular expression used to match PR URLs
const rePR = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;

// Create an Octokit client authenticated as a GitHub App
const MyOctokit = Octokit.plugin(paginateRest);
const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  },
  Octokit: MyOctokit
});

const { data: appData } = await app.octokit.request('/app');
console.log(`${appData.name} - ${appData.slug}`);
console.log(`${appData.html_url}`);
console.log();

// Comments from the bot on a PR are made under the app's slug name
// with a "[bot]" suffix.
const appLogin = appData.slug + '[bot]';

// Handle event notifications.
// The list of possible events and related action types is documented at:
// https://docs.github.com/en/webhooks/webhook-events-and-payloads
const webhooksEvents = [
  'issues.closed',
  'issues.locked',
  'pull_request.opened',
  'pull_request.reopened',
  'pull_request.edited',
  'pull_request.synchronize',
  'issue_comment.created',
  'issue_comment.edited'
];
app.webhooks.on(webhooksEvents, async ({ octokit, payload }) => {
  if (payload.repository.full_name === claRepo) {
    // In the repository that collects CLA commitments, look at issues that are
    // both closed and locked (typically happens after the list of CLA
    // commitments gets updated).
    // Note: the tool currently assumes that the maintainer validates the PR
    // URL that appears in the issue. If that PR URL is wrong, the CLA checker
    // will end up checking a PR that it's not supposed to look at.
    // TODO: Look for all open PRs from the same contributor in the repository instead.
    if (payload.issue &&
        payload.issue.state === 'closed' &&
        payload.issue?.locked &&
        !['off-topic', 'too heated', 'spam'].includes(payload.issue.active_lock_reason)) {
      console.log(`New locked issue in the CLA commitments repository`);
      console.log(`- issue: ${payload.issue.html_url}`);
      console.log(`- author: ${payload.issue.user.login}`);

      const body = payload.issue.body;
      const startPos = body.indexOf(prAnchor);
      if (startPos === -1) {
        console.log('- could not find the project repository in the issue');
        return;
      }
      const endPos = body.indexOf('###', startPos + prAnchor.length);
      const repositorySection = body.substring(startPos + prAnchor.length, endPos);
      const match = repositorySection.trim().match(/([^\s]+)\/([^\s]+)/);
      if (!match) {
        console.log('- could not find a repository in the project repository section');
        console.log(repositorySection);
        return;
      }
      const [, projectOwner, projectRepo] = match;
      console.log(`- repository: ${projectOwner}/${projectRepo}`);

      const pullRequests = await octokit.paginate(
        octokit.rest.pulls.list,
        { owner: projectOwner, repo: projectRepo, per_page: 100 },
        response => response.data.filter(pr => pr.user.id === payload.issue.user.id)
      );
      console.log(`- found ${pullRequests} PRs created by ${payload.issue.user.login}`);
      for (const pr of pullRequests) {
        console.log(`- re-check PR: ${pr.html_url}`);
        await checkPRContributor(pr, octokit);
      }
    }
  }
  else {
    // In repositories that need CLA commitments, we're only interested in new
    // pull requests in theory. The checker also handles new comments and
    // editions to give maintainers a mechanism to revalidate a PR.
    // Note: The checker skips over comments by itself since that typically
    // means that it just added a need CLA comment.
    if ((payload.pull_request || payload.issue?.pull_request) &&
        (payload.sender.login !== appLogin)) {
      console.log(`New PR event from ${payload.repository.full_name}`);
      const pr = payload.pull_request?.html_url ??
        payload.issue.pull_request.html_url;
      console.log(`- PR: ${pr}`);
      await checkPRContributor(pr, octokit);
    }
  }
});

// TODO: Handle errors
app.webhooks.onError((error) => {
  console.error(error);
});

// Launch the web server to listen for GitHub webhooks
const port = process.env.PORT || 3000;
const path = '/api/webhook';
const localWebhookUrl = `http://localhost:${port}${path}`;

const middleware = createNodeMiddleware(app.webhooks, { path });
http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`);
  console.log('Press Ctrl + C to quit.');
  console.log();
});


/******************************************************************************
 * Helper functions to check a pull request
 *****************************************************************************/
/**
 * Make sure that the pull request identified by its URL is from a contributor
 * for whom we already collected a CLA commitment and flag the PR accordingly
 * depending on the outcome of the check.
 */
async function checkPRContributor(pr, octokit) {
  let owner = null;
  let repo = null;
  let repository = null;
  let pull_number = null;
  let prUrl = null;
  let sha = null;
  const contributor = {};

  // Function may be called with a PR object or with the URL of a PR.
  // Let's populate the data we need depending on what was used.
  if (typeof pr === 'string') {
    try {
      prUrl = pr;
      [, owner, repo, pull_number] = pr.match(rePR);
      const res = await octokit.rest.pulls.get({ owner, repo, pull_number });
      sha = res.data.head.sha;
      contributor.id = res.data.user.id;
      contributor.name = res.data.user.login;
    }
    catch (error) {
      console.log('- an error occurred while retrieving PR info');
      console.error(error);
      return;
    }
  }
  else {
    prUrl = pr.html_url;
    owner = pr.head.repo.owner.login;
    repo = pr.head.repo.name;
    pull_number = pr.number;
    sha = pr.head.sha;
    contributor.id = pr.user.id;
    contributor.name = pr.user.login;
  }
  repository = `${owner}/${repo}`;

  try {
    const commitments = await getCommitmentsFor(repository, octokit);
    if (commitments.find(commitment => commitment.id === contributor.id)) {
      // The contributor already approved the CLA
      console.log(`- ${contributor.name} (id: ${contributor.id}) already approved the CLA for ${repository}`);

      // Delete the previous comment from the checker if needed
      const checkerComment = await getCommentFromChecker(owner, repo, pull_number, octokit);
      if (checkerComment) {
        console.log(`- delete need CLA comment at ${checkerComment.html_url}`);
        await octokit.rest.issues.deleteComment({
          owner, repo, comment_id: checkerComment.id
        });
      }

      // Make sure that the last PR commit has a "success" commit status for
      // the contributor agreement check.
      await octokit.request(
        'POST /repos/{owner}/{repo}/statuses/{sha}', {
        owner, repo, sha,
        state: 'success',
        target_url: `https://github.com/${claRepo}/blob/main/${owner}/${repo}.json`,
        description: `Agreement found for @${contributor.name}.`,
        context: 'Contributor agreement'
      });
    }
    else {
      // CLA Commitment needed
      // Check whether the CLA checker bot already issued a comment
      console.log(`- ${contributor.name} (id: ${contributor.id}) needs to approve the CLA for ${repository}`);
      const checkerComment = await getCommentFromChecker(owner, repo, pull_number, octokit);
      let checkerCommentUrl = null;
      if (checkerComment) {
        checkerCommentUrl = checkerComment.html_url;
        console.log(`- need CLA comment already exists: ${checkerCommentUrl}`);
      }
      else {
        // Note: the CLA checker expects the CLA issue template to have a
        // "repository" input field and a "pr" input field.      
        console.log(`- add need CLA comment`);
        const issueTitle = encodeURIComponent(`@${contributor.name} approves the CLA for \`${repository}\``);
        const claUrl = `https://github.com/${claRepo}/issues/new?` +
          [
            `template=${claIssueTemplate}`,
            `title=${issueTitle}`,
            `repository=${encodeURIComponent(repository)}`,
            `pr=${encodeURIComponent(prUrl)}`
          ].join('&');
        const res = await octokit.rest.issues.createComment({
          owner, repo,
          issue_number: pull_number,
          body: prMessage
            .replace(/\{\{username\}\}/g, contributor.name)
            .replace(/\{\{approveClaUrl\}\}/g, claUrl)
        });
        checkerCommentUrl = res.data.html_url
        console.log(`- need CLA comment added: ${checkerCommentUrl}`);
      }

      // Make sure that the last PR commit has a "failure" commit status for
      // the contributor agreement check.
      await octokit.request(
        'POST /repos/{owner}/{repo}/statuses/{sha}', {
        owner, repo, sha,
        state: 'failure',
        target_url: checkerCommentUrl,
        description: `No agreement found for @${contributor.name}.`,
        context: 'Contributor agreement'
      });
    }
  }
  catch (error) {
    console.log('- could not check PR, an error occurred:');
    console.error(error);
    try {
      // TODO: Don't update the previous status if one was already set.
      // Reporting the error should only be useful when a new commit gets added
      // to the PR.
      console.log('- try to flag the PR with an error status');
      await octokit.request(
        'POST /repos/{owner}/{repo}/statuses/{sha}', {
        owner, repo, sha,
        state: 'error',
        description: `Could not check agreement for @${contributor.name}. An error occurred.`,
        context: 'Contributor agreement'
      });
    }
    catch (error) {
      // Not much we can do if we cannot report the error to the PR...
    }
  }
}


/**
 * Retrieve the list of known CLA commitments for the given project repository
 *
 * Note: The repository parameter should have the format `owner/name`.
 */
async function getCommitmentsFor(repository, octokit) {
  let commitments = [];
  try {
    console.log(`- look for commitments for ${repository}`);
    const res = await octokit.rest.repos.getContent({
      owner: claRepoOwner,
      repo: claRepoName,
      path: repository + '.json'
    });

    // Content is encoded in base64
    const content = Buffer.from(res.data.content, 'base64').toString();
    commitments = JSON.parse(content);
  }
  catch (error) {
    // Note: Error may simply be due to the fact that the JSON file does not
    // exist yet.
    if (error.response) {
      if (error.response.status !== 404) {
        console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`);
      }
    }
    else {
      console.error(error);
    }
  }
  return commitments;
}


/**
 * Retrieve the first issue/PR comment from the CLA checker if any.
 */
async function getCommentFromChecker(owner, repo, issue_number, octokit) {
  const comments = await octokit.paginate(
    octokit.rest.issues.listComments,
    { owner, repo, issue_number, per_page: 100 },
    (response, done) => {
      if (response.data.find(issue => issue.user.login === appLogin)) {
        done();
      }
      return response.data;
    }
  );
  if (comments.length > 0) {
    const lastComment = comments[comments.length - 1];
    if (lastComment.user.login === appLogin) {
      return lastComment;
    }
  }
  return null;
}