# Tool details for the W3C Open Source Program Maintainers

The CLA checker is a Node.js HTTP server app that exposes a webhook. 

## Deploying the server

To deploy an instance of the CLA checker:

1. Clone this repository
2. Install dependencies through `npm ci`
3. Set the appropriate [environment variables](#configuration-parameters). They may be provided in a `.env` file.
4. Run the server with `npm run server`.

> [!NOTE]  
> To test the CLA checker locally, you'll need to create a public facing URL, e.g., using [smee.io](https://smee.io/) or [ngrok](https://ngrok.com/).

## Creating the GitHub App

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

## Installing the CLA checker in the CLA commitments repository

[Install](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app) the CLA checker GitHub app in the [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) repo.

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

