# CLA checker

For its pilot [W3C Open Source Program](https://github.com/w3c-oss/open-source-program#w3c-open-source-program), W3C asks all contributors to a Project to agree to the [W3C Open Source Individual Contributor License Agreement](https://www.w3.org/2026/07/w3c-open-source-icla.html) (referred to as the "CLA" below) so that W3C may (if necessary) relicense the full set of contributions.

Authenticated GitHub users make a CLA commitment for a Project Repo that has [enabled the CLA checker](#how-to-enable-the-CLA-checker-in-a-project-repo) by:

* visiting a repo used to record all CLA commitments made as part of the W3C Open Source Program: the [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) repo, then
* opening an issue with the appropriate template and checking the appropriate boxes ([`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) to make the commitment.

After staff review (e.g., to avoid spam), the commitment is recorded in the [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) repo and the users may proceed make contributions to the selected Project Repo.

The following sections explain the workflows for:

* [Recording CLA commitments](#recording-CLA-agreements)
* [User journey to record a commitment](#user-journey-to-record-a-commitment)

## Recording CLA commitments

> [!IMPORTANT]
> The CLA checker is not directly involved in this part of the workflow. Automation rather takes place through a GitHub workflow in the [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) repo.

* As described above, to make a CLA commitment for a given Project Repo, a single contributor raises an issue in the w3c-oss/cla-commitments repo using the appropriate issue template.
* The W3C Open Source Program maintainer reviews the issue and approves it by adding an "approved" label. 
* This triggers a workflow in the w3c-oss/cla-commitments repo which:
  1. Locks the issue to prevent further updates.
  2. Records the CLA commitment in the appropriate JSON file in the repository.
  3. Closes the issue.

The appropriate JSON file for the CLA commitment is a file named `[owner]/[repository].json`, which contains an array of objects that represent individual CLA commitments. Each object has the following keys:

- `id`: The GitHub ID of the contributor.
- `username`: The GitHub username of the contributor at the time the CLA was signed.
- `date`: The signature date as a string that follows the ISO 8601 format `YYYY-MM-DDThh:mm:ssZ`.
- `issue`: URL of the issue created by the contributor where the signature was recorded.
- `pr`: URL of the pull request from which the signature originates (optional).

## User journey to record a commitment

The user journey starts with the creation or update to a pull request in a Project Repo.

### Checking for previously recorded commitments

* The CLA checker receives a notification from GitHub through an [HTTP webhook](https://docs.github.com/en/webhooks/about-webhooks).
* The CLA checker uses the information it receives to assess whether there is a record of these contributors having previously made CLA commitments for this repo.
* The PR status is updated accordingly: 
   * If there are previously recorded agreements, the CLA checker changes the status to green.
   * If not, the PR will receive a red "X", and the CLA checker will add a comment to the PR to invite the contributors to follow a link to the [`w3c-oss/cla-commitments`](https://github.com/w3c-oss/cla-commitments) repo to make a CLA commitment.

The pull request is not merged until the user has made a CLA commitment.

### Revalidating the PR

The CLA checker receives a notification from GitHub (through the same HTTP webhook) whenever an issue gets closed in the repository that collects CLA commitments. If that issue recorded a new CLA commitment for a repository, the CLA checker checks again the pull requests from the same contributor in that repository (if any).

## FAQ

### How do I use this checker in my Project Repo?

To enable the CLA checker in a repository, [install](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app) the CLA checker GitHub app in it.

> [!NOTE]
> You can [review and disable](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps#blocking-access) the CLA checker GitHub app on a repository at any time.

### What were the design goals of this project?

* Reduce the friction for Projects of collecting CLA commitments. To that end, we:
   * Use a GitHub app to make installation easy and to avoid adding noise to a Project Repo.
   * Use GitHub issues and templates to streamline accepting commitments from authenticated GitHub users.
* Make CLA commitments non-repudiable. To that end we:
   * Record CLA commitments in a repo managed by the W3C staff (thus, strongly permission protected).
   * Leverage features (e.g., locking of issues) to minimize the risk that people will attempt to change history.
   * Rely on GitHub history to make it easy to audit situations where changes do occur.
   * Rely on the GitHub `id`. Contributors may change their GitHub username at any time, but their GitHub `id` remains the same. As such, any contribution prior to a username change can continue to be attributed to them and linked to a CLA commitment. The contributor does not need to approve the CLA again with their new username.

### Can I force a new PR review?

Once in a while, notifications can get lost, or the checker may fail to process them due to some transient server or network issue. There is no direct way to send the notifications again. If you need to trigger the CLA checker again on a PR, add/edit a comment in this PR so that a new notification gets sent. Similarly, if you need to trigger the CLA checker on an issue again in the repository that collects CLA commitments, reopen it and close it again.

### Can a CLA commitment be rescinded?

In general, no. However, there may be situations where it is appropriate to remove a commitment (e.g., it was made in error, it was spam, etc.). This can be done manually by the W3C staff, and the GitHub history should be used to record the rationale transparently.

## For W3C Open Source Project staff

See [detailed tool information](tool-details.md) for more information about setting up the app itself, configuring the CLA commitments repo, etc.
