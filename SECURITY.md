# Security

WiredMind is a static educational site at [wiredmind.app](https://wiredmind.app). It has no accounts, no database, and no server-side user data, but a bug can still hurt visitors, for example through script injection or a tampered data release.

## Reporting a vulnerability

Please report it privately through [GitHub's private vulnerability reporting](https://github.com/GuyDahn/wiredmind-edu/security/advisories/new), not in a public issue or pull request. Include the page or file, what an attacker can do, and the steps to reproduce it.

You should hear back within a week. Once a fix is live, the advisory is published with credit to you unless you'd rather stay anonymous.

## Scope

In scope: the code in this repository, the site at wiredmind.app, and the data files in this repository's GitHub Releases.

Out of scope: denial of service through traffic volume, missing hardening with no demonstrated impact, and bugs in third-party services such as Vercel or GitHub, which should go to those vendors.

Only the latest version on `main` is supported.
