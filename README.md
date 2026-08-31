# CLA checker

The CLA checker is used in the [W3C Open Source Program](https://github.com/w3c-oss/open-source-program#w3c-open-source-program) to check that contributions are from individuals who signed the Contributor License Agreement (CLA) for the project.

## Workflow

### Checking contributions

The CLA checker receives a notification from GitHub (through an [HTTP webhook](https://docs.github.com/en/webhooks/about-webhooks)) whenever a pull request (PR) is created or updated in repositories in which it is enabled. It uses the information it receives to assess whether the contributors of the PR approved the CLA.

Count as having approved the CLA any user, identified by their GitHub account, who raised an issue with the appropriate template in a dedicated repository and checked the appropriate boxes ([`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) for the W3C Open Source Program). See [Collecting CLA commitments](#collecting-cla-commitments) below.

The status of the PR gets changed depending on the result of the check. It it's acceptable, it will get changed to green; if not, the PR will get a red cross, and the CLA checker will add a comment to the PR to invite the contributor to follow a ling to approve the CLA.

To approve the CLA, the contributor needs to create an issue in the appropriate repository, [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) for the W3C Open Source Program.

### Collecting CLA commitments

> [!IMPORTANT]
> The CLA checker is not involved in this part of the workflow. Automation rather takes place through a GitHub workflow in the repository that collects CLA commitments.

CLA commitments are collected through issues in a dedicated repository, [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) for the W3C Open Source Program.

An issue records the CLA commitment from a single contributor for a given project repository. The issue needs to be created by the contributor following the appropriate issue template. It needs to be reviewed by a program maintainer, who approves it by adding an "approved" label. This triggers a workflow in the repository which:

1. Locks the issue to prevent further updates.
2. Records the CLA commitment in the appropriate JSON file in the repository.
3. Closes the issue.

The appropriate JSON file for the CLA commitment is a file named `[owner]/[repository].json`, which contains an array of objects that represent individual CLA commitments. Each object has the following keys:

- `id`: The GitHub ID of the contributor.
- `username`: The GitHub username of the contributor at the time the CLA was signed.
- `date`: The signature date as a string that follows the ISO 8601 format `YYYY-MM-DDThh:mm:ssZ`.
- `issue`: URL of the issue created by the contributor where the signature was recorded.
- `pr`: URL of the pull request from which the signature originates (optional).

> [!NOTE]  
> Contributors may change their GitHub username at any time, but their GitHub `id` remains the same. As such, any contribution prior to a username change can continue to be attributed to them and linked to a CLA commitment. The contributor does not need to approve the CLA again with their new username.

### Revalidating the PR

The CLA checker receives a notification from GitHub (through the same HTTP webhook) whenever an issue gets closed in the repository that collects CLA commitments. If that issue recorded a new CLA commitment for a repository, the CLA checker checks again the pull requests from the same contributor in that repository (if any).

## How to deploy the CLA checker

## Deploy the server

The CLA checker is a Node.js HTTP server app that exposes a webhook. To deploy an instance of the CLA checker:

1. Clone this repository
2. Install dependencies through `npm ci`
3. Create a `.env` file with the appropriate [configuration parameters](#configuration-parameters)
4. Run the server with `npm run server`.

> [!NOTE]  
> To test the CLA checker locally, you'll need to create a public facing URL, e.g., using [smee.io](https://smee.io/) or [ngrok](https://ngrok.com/).

### Create the GitHub App

[Register](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) a GitHub App, typically under the GitHub organization that hosts the repositories to monitor.

In the registration form:

1. Set the GitHub App name to `W3C Open Source CLA checker` (any name would work in practice)
2. Enter a description
3. Set the Homepage URL to the URL of the server: `https://[server]`.
4. Make sure Webhook is active and set the URL to `https://[server]/api/webhook`.
5. Create a secret password.
6. In "Permissions", give the App read-only permissions for "Contents", and read/write permissions for "Issues", "Pull requests", and "Commit statuses" (note: this will also automatically give it read-only permissions for Metadata)
7. In "Subscribe to events", select "Issues", "Issue comment", and "Pull request".

Leave the other configuration settings to their default values.

> [!NOTE]
> Once the GitHub App is registered, you can get back to the page that describes it at any time through the "Applications" menu under "Integration" in your org's settings page on GitHub, by clicking on "My GitHub Apps", and selecting "Edit".

We need to set up a few more things from that page after registration:

1. Generate a private key under the "Private keys" section. This should automatically make you download a `.pem` file with the newly generated private key.
2. Upload that private key file to the server (see [Configuration parameters](#configuration parameters) below).
3. Choose "Install app" in the main menu (should be on the top left). Choose the org account on which to install the CLA checker. Choose "only select repositories" and select the first repository on which to install the app.

### Install the CLA checker in the CLA commitments repository

[Install](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app) the CLA checker GitHub app in the repository that collects CLA commitments.

### Configuration parameters

Configuration parameters need to be specified as environment variables, or in a `.env` file. To create a `.env` file, copy and rename the `.env.sample` file.

| Environment variable | Required | Default value            | Quick description             |
| -------------------- | -------- | ------------------------ | ------------------------------|
| `APP_ID`             | yes      |                          | GitHub App ID                 |
| `WEBHOOK_SECRET`     | yes      |                          | GitHub App webhook secret     |
| `PRIVATE_KEY_PATH`   | no       | `key.pem`                | GitHub App private key file   |
| `NEED_CLA_MSG_PATH`  | no       | `need-cla-message.md`    | "Need CLA" message template   |
| `CLA_REPOSITORY`     | no       | `w3c-oss/cla-commitments`| Repo with CLA commitments     |
| `CLA_ISSUE_TEMPLATE` | no       | `cla-commitment.yml`     | CLA commitment issue template |
| `CLA_ISSUE_ANCHOR`   | no       | `### Project repository` | Issue section with repo name  |
| `SERVER_PORT`        | no       | `3000`                   | HTTP port for the server      |
| `WEBHOOK_PATH`       | no       | `/api/webhook`           | Webhook path                  |

Two parameters (and one file) are needed:
- `APP_ID` must match the App ID in the GitHub app info page.
- `WEBHOOK_SECRET` must match the Webhook secret set in the GitHub app info page. It allows the server app to authenticate notifications it receives from GitHub.
- `PRIVATE_KEY_PATH` must target a `.pem` file that contains the Private key generated in the GitHub app info page. The key allows the server app to authenticate to GitHub.

Additional notes:
- `CLA_ISSUE_TEMPLATE` is the name of the issue template in the repository that records the CLA commitments. It is used to create a proper "Approve CLA commitment" link when the CLA checker asks the contributor to approve the CLA.
- `CLA_ISSUE_ANCHOR` is the name of the section that contains the repository for which the CLA commitment is made in the issue that records a CLA commitment. It is used to revalidate all open PRs from the contributor when a CLA commitment gets recorded. This anchor needs to match the relevant section title in the CLA commitment issue template.
- `WEBHOOK_PATH` sets the callback URL. Make sure that the Webhook URL in the GitHub app info page is the right one.


## How to enable the CLA checker in a repository

To enable the CLA checker in a repository, [install](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app) the CLA checker GitHub app in it.

> [!NOTE]
> You can [review and disable](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps#blocking-access) the CLA checker GitHub app on a repository at any time.


## How to force a new review

Once in a while, notifications can get lost, or the checker may fail to process them due to some transient server or network issue. There is no direct way to send the notifications again. If you need to trigger the CLA checker again on a PR, add/edit a comment in this PR so that a new notification gets sent. Similarly, if you need to trigger the CLA checker on an issue again in the repository that collects CLA commitments, reopen it and close it again.
