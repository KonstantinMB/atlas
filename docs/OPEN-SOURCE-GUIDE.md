# Open Source Release Guide for Atlas

**Purpose**: Step-by-step guide to properly open source the Atlas intelligence platform on GitHub

**Last Updated**: 2026-03-11

---

## Table of Contents

1. [License Selection](#1-license-selection)
2. [Required Files Checklist](#2-required-files-checklist)
3. [README.md Structure](#3-readmemd-structure)
4. [CONTRIBUTING.md Guidelines](#4-contributingmd-guidelines)
5. [CODE_OF_CONDUCT.md](#5-code_of_conductmd)
6. [GitHub Repository Setup](#6-github-repository-setup)
7. [Documentation Organization](#7-documentation-organization)
8. [Community Building](#8-community-building)
9. [Pre-Release Checklist](#9-pre-release-checklist)
10. [Post-Release Tasks](#10-post-release-tasks)

---

## 1. License Selection

### Recommended: AGPL-3.0 ✅

**Why AGPL-3.0 for Atlas:**

1. **Network-deployed software**: Atlas runs as a web application (SaaS)
2. **Copyleft protection**: Ensures derivatives remain open source, even when deployed as a service
3. **Ecosystem consistency**: WorldMonitor (reference architecture) uses AGPL-3.0
4. **Community contributions**: Guarantees improvements are shared back, even from hosted instances
5. **SaaS loophole closure**: Unlike GPL, AGPL requires source disclosure for network services

**AGPL-3.0 Key Terms:**

- ✅ Users can use, modify, and distribute the code
- ✅ Commercial use permitted
- ⚠️ **Must disclose source code** if running modified version as a web service
- ⚠️ All derivative works must also be AGPL-3.0
- ⚠️ Network users must be able to download the source

**Alternative Licenses (if AGPL too restrictive):**

| License | Use Case | Tradeoff |
|---------|----------|----------|
| **MIT** | Maximum adoption, commercial-friendly | Anyone can make proprietary versions |
| **Apache 2.0** | Patent protection, commercial-friendly | No copyleft requirement |
| **GPL-3.0** | Copyleft, but **SaaS loophole** | Hosted services can keep modifications private |

### Implementation Steps

1. **Create LICENSE file** in project root:

```bash
# Download AGPL-3.0 text
curl https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE
```

2. **Add license header** to all source files:

```typescript
/**
 * Atlas - Global Intelligence & Paper Trading Platform
 * Copyright (C) 2024-2026 [Your Name/Organization]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
```

3. **Add license badge** to README:

```markdown
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
```

---

## 2. Required Files Checklist

### Essential Files

- [ ] **README.md** - Project overview, setup, usage (see section 3)
- [ ] **LICENSE** - AGPL-3.0 full text
- [ ] **CONTRIBUTING.md** - How to contribute (see section 4)
- [ ] **CODE_OF_CONDUCT.md** - Community standards (see section 5)
- [ ] **.github/ISSUE_TEMPLATE/** - Issue templates for bugs/features
- [ ] **.github/PULL_REQUEST_TEMPLATE.md** - PR template
- [ ] **SECURITY.md** - Security policy and vulnerability reporting
- [ ] **CHANGELOG.md** - Version history (Keep a Changelog format)

### Recommended Files

- [ ] **ARCHITECTURE.md** - System design overview (link to existing docs)
- [ ] **API.md** - API endpoint documentation
- [ ] **DEPLOYMENT.md** - Production deployment guide
- [ ] **FAQ.md** - Frequently asked questions
- [ ] **.env.example** - Environment variables template (already exists)
- [ ] **docker-compose.yml** - Local development setup (if applicable)

### Repository Configuration

- [ ] **.gitignore** - Already exists, ensure comprehensive
- [ ] **.github/dependabot.yml** - Automated dependency updates
- [ ] **.github/workflows/ci.yml** - GitHub Actions CI/CD
- [ ] **package.json** - Update with repository, bugs, homepage URLs

---

## 3. README.md Structure

### Recommended Structure

```markdown
# Atlas - Global Intelligence & Paper Trading Platform

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![CI Status](https://github.com/[username]/atlas/workflows/CI/badge.svg)](https://github.com/[username]/atlas/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> Real-time global intelligence dashboard with geopolitical risk analysis and paper trading engine.
> Built with vanilla TypeScript, deck.gl, and Vercel Edge Functions.

![Atlas Dashboard Screenshot](docs/images/screenshot.png)

## ✨ Features

- 🌍 **Interactive 3D Globe** - deck.gl visualization with 8 toggleable intelligence layers
- 📊 **Real-Time Data** - 32+ OSINT sources (GDELT, USGS, NASA FIRMS, ACLED, Polymarket)
- 🤖 **AI-Powered Insights** - LLM-generated briefs via Groq (Llama 3.1)
- 📈 **Paper Trading Engine** - Geopolitical event-driven trading with 5 strategies
- 🔐 **Auth & Persistence** - Email/password auth, dual-layer (localStorage + Redis)
- 🏆 **Leaderboard** - Competitive paper trading rankings (weekly/monthly/quarterly)
- ⚡ **Performance** - <300KB bundle, Edge Functions, 3-tier caching

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Vercel account (free tier works)
- Upstash Redis account (free tier works)
- API keys (all free tier): Finnhub, CoinGecko, FRED, Groq

### Installation

```bash
# Clone the repository
git clone https://github.com/[username]/atlas.git
cd atlas

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your API keys to .env
# FINNHUB_API_KEY=...
# UPSTASH_REDIS_REST_URL=...
# etc.

# Run development server
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:5173` to see the dashboard.

## 📖 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - System design, data flow, agent orchestration
- **[Data Sources](docs/DATA-SOURCES.md)** - 32+ free OSINT APIs with cache strategy
- **[Paper Trading](docs/VALIDATION-REPORT.md)** - Complete E2E validation report
- **[Contributing](CONTRIBUTING.md)** - How to contribute code, docs, or data sources
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment to Vercel + Railway

## 🎯 Use Cases

- **OSINT Analysts** - Real-time geopolitical event monitoring with convergence detection
- **Traders** - Backtest geopolitical risk strategies with paper trading
- **Researchers** - Study correlation between instability indices and market movements
- **Developers** - Learn edge functions, deck.gl, vanilla TS architecture

## 🏗️ Architecture

```
Atlas
├── Frontend (Vite + TypeScript, <300KB)
│   ├── deck.gl Globe (8 layers: military, cables, nuclear, fires, etc.)
│   ├── Intelligence Engine (CII, convergence, anomaly detection)
│   └── Paper Trading Engine (5 strategies, FIFO portfolio, 11 risk checks)
├── Edge Functions (Vercel, 15+ endpoints)
│   ├── Data proxies (GDELT, USGS, ACLED, Polymarket, etc.)
│   ├── AI (Groq LLM summarization + sentiment)
│   └── Trading API (portfolio, leaderboard, auth)
├── Cache Layer (3-tier: memory → Redis → upstream)
└── WebSocket Relay (Railway, AIS vessels + OpenSky aircraft)
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Quick ways to contribute:**
- 🐛 Report bugs via [Issues](https://github.com/[username]/atlas/issues)
- 💡 Suggest features or data sources
- 📖 Improve documentation
- 🔧 Submit PRs for bug fixes or enhancements

## 📊 Project Status

- [x] Phase 0-3: Foundation, globe, data pipelines, intelligence engine ✅
- [x] Phase 4: Paper trading engine (5 strategies, portfolio, risk management) ✅
- [x] Phase 5: Production deployment, leaderboard, PWA ✅
- [ ] Phase 6: Advanced strategies (prediction markets, cross-asset)
- [ ] Phase 7: Backtesting engine, strategy optimizer

See [MVP-PLAN.md](docs/MVP-PLAN.md) for detailed roadmap.

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

**Why AGPL?**
- Ensures improvements to hosted instances are shared back with the community
- Prevents proprietary forks of a network-deployed service
- Maintains open source ecosystem integrity

See [LICENSE](LICENSE) for full text.

**Important**: If you deploy a modified version of Atlas as a web service, you **must** make your source code available to users under AGPL-3.0.

## 🙏 Acknowledgments

- **[WorldMonitor](https://github.com/koala73/worldmonitor)** by Elie Habib - Reference architecture (AGPL-3.0)
- **[deck.gl](https://deck.gl/)** - WebGL-powered visualization
- **Data Providers** - GDELT, USGS, NASA, ACLED, Polymarket (all free/public APIs)
- **[Upstash](https://upstash.com/)** - Serverless Redis
- **[Groq](https://groq.com/)** - Fast LLM inference

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/[username]/atlas/issues)
- **Discussions**: [GitHub Discussions](https://github.com/[username]/atlas/discussions)
- **Email**: [your-email@example.com]
- **Twitter**: [@yourhandle]

## ⭐ Star History

If you find Atlas useful, please star the repo! It helps others discover the project.

[![Star History Chart](https://api.star-history.com/svg?repos=[username]/atlas&type=Date)](https://star-history.com/#[username]/atlas&Date)

---

**Built with ❤️ for the open source intelligence and trading communities.**
```

### Key README Elements Explained

1. **Badges** - Show license, CI status, contribution welcome
2. **Visual** - Screenshot above the fold (create `docs/images/screenshot.png`)
3. **Features** - Bullet points with emojis for scannability
4. **Quick Start** - Get users running in <5 minutes
5. **Documentation Links** - Link to existing docs (PRD, MVP-PLAN, etc.)
6. **Architecture Diagram** - ASCII art for quick understanding
7. **License Explanation** - Why AGPL, what it means for users
8. **Acknowledgments** - Credit WorldMonitor, data sources

---

## 4. CONTRIBUTING.md Guidelines

### Recommended Content

```markdown
# Contributing to Atlas

Thank you for considering contributing to Atlas! This document outlines the process and guidelines.

## Code of Conduct

This project adheres to the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## How Can I Contribute?

### 🐛 Reporting Bugs

**Before submitting**, check existing [Issues](https://github.com/[username]/atlas/issues) to avoid duplicates.

**Bug Report Should Include**:
- Clear title (e.g., "Portfolio panel crashes when closing SHORT position")
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS version
- Console errors (if any)

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).

### 💡 Suggesting Features

We welcome feature ideas! Please:
1. Check [Discussions](https://github.com/[username]/atlas/discussions) first
2. Open an issue with `[Feature Request]` prefix
3. Describe the problem you're solving
4. Propose a solution (UI mockups welcome!)

### 📝 Improving Documentation

Documentation PRs are highly valued:
- Fix typos, broken links, or unclear explanations
- Add examples to existing docs
- Translate docs to other languages (future)

### 🔧 Code Contributions

#### Development Setup

```bash
git clone https://github.com/[username]/atlas.git
cd atlas
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

#### Coding Conventions

**We follow the conventions in `CLAUDE.md`:**
- Vanilla TypeScript (NO React/Vue/Angular)
- camelCase for variables/functions, PascalCase for classes
- One component per file in `src/panels/`, `src/globe/layers/`
- Edge functions: `export const config = { runtime: 'edge' }`
- Use 3-tier caching (`api/_cache.ts`) for all external API calls

**Style**:
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Run `npm run typecheck` before committing

#### Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `master`: `git checkout -b feature/your-feature-name`
3. **Make your changes** following coding conventions
4. **Test thoroughly**:
   ```bash
   npm run typecheck  # TypeScript checks
   npm run build      # Production build succeeds
   # Manual testing in browser
   ```
5. **Commit** with clear messages:
   ```
   fix: resolve portfolio panel crash on SHORT close

   - Add null check in portfolio-manager.ts:275
   - Add test case for SHORT position FIFO close
   - Fixes #123
   ```
6. **Push** to your fork: `git push origin feature/your-feature-name`
7. **Open a PR** against `master` using the [PR Template](.github/PULL_REQUEST_TEMPLATE.md)

**PR Requirements**:
- ✅ Passes `npm run typecheck`
- ✅ Builds successfully (`npm run build`)
- ✅ No merge conflicts with `master`
- ✅ Clear description of what changed and why
- ✅ Links to related issue (if applicable)

#### Areas Needing Help

🏷️ Issues labeled [`good first issue`](https://github.com/[username]/atlas/labels/good%20first%20issue) are beginner-friendly.

**Priority areas**:
- 🌍 **New data sources** - Add free OSINT APIs (see `docs/DATA-SOURCES.md`)
- 📊 **New trading strategies** - Implement in `src/trading/strategies/`
- 🧪 **Testing** - Unit tests for portfolio manager, risk manager
- 📱 **Mobile UI** - Responsive improvements for <768px
- 🌐 **i18n** - Internationalization support
- 📖 **Tutorials** - Blog posts, video guides

## Development Workflow

### Agent-Based Architecture

Atlas uses specialized TypeScript "agents" (see `.claude/agents/`):
- **trading-agent** - Signal generation, execution
- **data-agent** - Market data streaming
- **risk-agent** - Pre-trade risk checks
- **frontend-agent** - UI components

When contributing:
- Follow the agent orchestration flow (see `CLAUDE.md`)
- Respect separation of concerns (data → intelligence → signals → risk → execution)

### File Organization

```
src/
├── globe/          # deck.gl layers (one per file)
├── panels/         # UI panels (one per file)
├── trading/        # Paper trading engine
│   ├── engine/     # Core (execution-loop, portfolio-manager, paper-broker)
│   ├── strategies/ # Trading strategies (add new ones here)
│   └── risk/       # Risk management (11 checks)
├── intelligence/   # Analytics (CII, convergence, anomaly)
└── lib/            # Shared utilities

api/                # Vercel Edge Functions
├── data/           # OSINT data adapters (add new sources here)
├── market/         # Financial data (Finnhub, Yahoo, etc.)
└── trading/        # Portfolio API (auth-required)
```

## Licensing

By contributing, you agree that your contributions will be licensed under **AGPL-3.0**.

**Important**: All code must be:
- ✅ Original work or properly attributed
- ✅ Compatible with AGPL-3.0
- ✅ Free of proprietary dependencies (free-tier APIs okay)

## Questions?

- 💬 **GitHub Discussions** for general questions
- 🐛 **GitHub Issues** for bugs or feature requests
- 📧 **Email** [your-email@example.com] for private matters

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` (alphabetical list)
- Release notes (per-version highlights)
- Yearly "Top Contributors" blog post

Thank you for making Atlas better! 🙌
```

---

## 5. CODE_OF_CONDUCT.md

### Recommended: Contributor Covenant

Use the standard **Contributor Covenant** (v2.1), the most widely adopted code of conduct.

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, caste, color, religion, or sexual
identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes
* Focusing on what is best for the overall community

Examples of unacceptable behavior:

* The use of sexualized language or imagery, and sexual attention or advances
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information without explicit permission
* Other conduct which could reasonably be considered inappropriate

## Enforcement Responsibilities

Project maintainers are responsible for clarifying and enforcing standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is officially representing the community in public spaces.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the project maintainers at [INSERT EMAIL HERE].

All complaints will be reviewed and investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage],
version 2.1, available at
https://www.contributor-covenant.org/version/2/1/code_of_conduct.html

[homepage]: https://www.contributor-covenant.org
```

**Action**: Replace `[INSERT EMAIL HERE]` with your enforcement contact.

---

## 6. GitHub Repository Setup

### Initial Setup

1. **Create repository** on GitHub:
   - Name: `atlas`
   - Description: "Real-time global intelligence dashboard with geopolitical risk analysis and paper trading engine"
   - Public
   - **Do NOT** initialize with README (already exists locally)

2. **Push existing code**:

```bash
# Add remote
git remote add origin https://github.com/[username]/atlas.git

# Ensure you're on master branch
git branch -M master

# Push
git push -u origin master
```

### Repository Settings

**General**:
- ✅ **Wikis**: Disabled (use `docs/` instead)
- ✅ **Issues**: Enabled
- ✅ **Projects**: Enabled (optional: create roadmap board)
- ✅ **Discussions**: Enabled (for Q&A, ideas)
- ✅ **Allow merge commits**: Enabled
- ✅ **Allow squash merging**: Enabled (recommended for clean history)
- ⚠️ **Allow rebase merging**: Disabled (prevent force-push issues)

**Branches**:
- **Default branch**: `master`
- **Branch protection rules** for `master`:
  - ✅ Require pull request before merging
  - ✅ Require approvals: 1 (if you have co-maintainers)
  - ✅ Dismiss stale reviews
  - ✅ Require status checks (CI) to pass
  - ⚠️ **Do NOT** require signed commits (creates friction for new contributors)

**Topics** (add for discoverability):
- `osint`
- `geopolitical-analysis`
- `paper-trading`
- `deckgl`
- `intelligence`
- `edge-functions`
- `vercel`
- `typescript`
- `trading-bot`
- `risk-management`

### Issue Templates

Create `.github/ISSUE_TEMPLATE/` with:

**1. bug_report.md**:
```markdown
---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - OS: [e.g. macOS 14.2]
 - Browser: [e.g. Chrome 120]
 - Node version: [e.g. 18.17.0]

**Additional context**
Console errors, network tab screenshots, etc.
```

**2. feature_request.md**:
```markdown
---
name: Feature Request
about: Suggest a new feature or improvement
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How would you solve it?

**Alternatives Considered**
What other approaches did you think about?

**Additional Context**
Mockups, examples from other projects, etc.
```

**3. data_source.md**:
```markdown
---
name: New Data Source
about: Suggest a new OSINT data source
title: '[DATA] '
labels: data-source, enhancement
assignees: ''
---

**Data Source Name**
E.g., "MarineTraffic AIS API"

**API Documentation**
Link to API docs.

**Free Tier Available?**
- [ ] Yes (describe limits)
- [ ] No

**Data Type**
- [ ] Geopolitical events
- [ ] Natural disasters
- [ ] Market data
- [ ] Satellite imagery
- [ ] Other: ___

**Use Case**
How would this data enhance Atlas?

**Implementation Notes**
Suggested endpoint location (e.g., `api/data/marine-traffic.ts`)
```

### Pull Request Template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description

Brief description of what this PR does.

Fixes #(issue number)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Checklist

- [ ] I have read the [CONTRIBUTING](../CONTRIBUTING.md) guidelines
- [ ] My code follows the style guidelines (see `CLAUDE.md`)
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] My changes generate no new TypeScript errors (`npm run typecheck`)
- [ ] My changes build successfully (`npm run build`)
- [ ] I have tested this in a browser (Chrome/Firefox/Safari)
- [ ] I have updated documentation if needed

## Screenshots (if applicable)

Add before/after screenshots for UI changes.

## Testing Instructions

How reviewers can test this PR:
1. Step 1
2. Step 2
3. Expected result: ...

## Additional Notes

Any other context about the PR.
```

---

## 7. Documentation Organization

### Current Structure (Keep)

```
docs/
├── PRD.md                        # Product requirements
├── MVP-PLAN.md                   # Implementation roadmap
├── DATA-SOURCES.md               # OSINT API catalog
├── VALIDATION-REPORT.md          # E2E system validation ✅ NEW
├── OPEN-SOURCE-GUIDE.md          # This file ✅ NEW
└── (future additions)
```

### Recommended Additions

**Create these new docs:**

1. **docs/ARCHITECTURE.md** (high-level system design):
```markdown
# Architecture Overview

## System Layers

1. **Frontend** (Vite + TypeScript)
2. **Edge Functions** (Vercel serverless)
3. **Cache Layer** (3-tier: memory → Redis → upstream)
4. **Data Sources** (32+ free OSINT APIs)
5. **WebSocket Relay** (Railway for AIS/OpenSky)

[Include diagrams from VALIDATION-REPORT.md Appendix C]
```

2. **docs/API.md** (endpoint documentation):
```markdown
# API Reference

## Public Endpoints (No Auth)

### GET /api/data/gdelt
Returns recent GDELT news events...

## Authenticated Endpoints

### GET /api/trading/portfolio
Returns user's paper trading portfolio...
```

3. **docs/DEPLOYMENT.md** (production setup):
```markdown
# Deployment Guide

## Vercel (Frontend + Edge Functions)

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel --prod`
3. Set environment variables in Vercel dashboard

## Railway (WebSocket Relay)

...
```

4. **SECURITY.md** (in project root):
```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities.

Email: [security@yourdomain.com]

We will respond within 48 hours.

## Security Features

- Password hashing: PBKDF2 (100K iterations)
- Session tokens: Cryptographically random, 30-day expiry
- API rate limiting: 60 req/min per IP (Finnhub), etc.
- CORS: Allowlist only (`api/_cors.ts`)
```

5. **CHANGELOG.md** (track releases):
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- New prediction market signals (Polymarket integration)

### Fixed
- Portfolio panel crash on SHORT position close (#123)

## [1.0.0] - 2026-03-11

### Added
- Initial public release
- Paper trading engine with 5 strategies
- Real-time OSINT data (32 sources)
- Interactive 3D globe with 8 layers
- Leaderboard (weekly/monthly/quarterly)

[Unreleased]: https://github.com/[username]/atlas/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/[username]/atlas/releases/tag/v1.0.0
```

---

## 8. Community Building

### Initial Promotion

**Launch Announcement** (post on):
- [ ] Hacker News (https://news.ycombinator.com/submit)
- [ ] Reddit:
  - r/webdev
  - r/typescript
  - r/dataisbeautiful
  - r/geopolitics
  - r/OSINT
  - r/algotrading
- [ ] Twitter/X (your account)
- [ ] LinkedIn (professional network)
- [ ] Dev.to blog post
- [ ] Product Hunt (visual products do well)

**Blog Post Template**:
```markdown
Title: "I built Atlas: An open-source geopolitical intelligence dashboard with paper trading"

Hook: "Ever wondered if major geopolitical events could predict market movements? I spent [X months] building an OSINT platform to test this hypothesis—and it's now open source."

Include:
- Problem statement (fragmented OSINT sources)
- Technical decisions (why vanilla TS, why AGPL-3.0)
- Cool features (3D globe, AI insights, paper trading)
- Challenges faced (Vercel CPU limits, data source integration)
- What I learned
- Call to action: "Try it live: [demo URL] | Star on GitHub: [repo URL]"
```

### Engagement Strategy

**First 100 Stars**:
1. **Respond quickly** to issues/PRs (<24 hours)
2. **Label issues** clearly (`good first issue`, `help wanted`, `documentation`)
3. **Create discussions** for:
   - "What data sources should we add next?"
   - "Share your paper trading strategies"
   - "Show and Tell: Your Atlas forks"
4. **Write tutorials**:
   - "How to add a new OSINT data source to Atlas"
   - "Building a custom trading strategy"
   - "Deploying Atlas to your own Vercel account"

**After 100 Stars**:
- **Monthly updates** via GitHub Discussions or blog
- **Contributor spotlights** (highlight PRs in release notes)
- **Hacktoberfest participation** (October, add `hacktoberfest` topic)
- **Conference talks** (submit to OSINTCurious, local meetups)

### Community Channels

Consider creating (only when needed, avoid ghost towns):
- **Discord server** (when >200 stars, for real-time chat)
- **Twitter account** (e.g., @AtlasOSINT for updates)
- **YouTube channel** (demos, tutorials)

---

## 9. Pre-Release Checklist

### Code Quality

- [ ] All files have AGPL-3.0 header comments
- [ ] No API keys or secrets in git history (`git log --all --full-history --source -- .env`)
- [ ] `.gitignore` comprehensive (check `.env`, `dist/`, `node_modules/`)
- [ ] `package.json` updated with:
  ```json
  {
    "repository": {
      "type": "git",
      "url": "https://github.com/[username]/atlas.git"
    },
    "bugs": {
      "url": "https://github.com/[username]/atlas/issues"
    },
    "homepage": "https://github.com/[username]/atlas#readme",
    "license": "AGPL-3.0"
  }
  ```
- [ ] TypeScript builds without errors (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Test locally with fresh clone:
  ```bash
  cd /tmp
  git clone https://github.com/[username]/atlas.git atlas-test
  cd atlas-test
  npm install
  npm run dev
  # Does it work?
  ```

### Documentation

- [ ] README.md complete with screenshots
- [ ] CONTRIBUTING.md with clear guidelines
- [ ] LICENSE file with AGPL-3.0 full text
- [ ] CODE_OF_CONDUCT.md with enforcement email
- [ ] SECURITY.md with vulnerability reporting process
- [ ] Issue templates created (bug, feature, data source)
- [ ] PR template created
- [ ] `.env.example` has all required variables (no real keys!)
- [ ] All docs have accurate file paths (no broken links)

### Legal & Licensing

- [ ] All dependencies are AGPL-compatible (check `package.json`)
  - ✅ MIT, Apache-2.0, BSD → compatible
  - ⚠️ GPL-2.0 → compatible (but check version)
  - ❌ Proprietary licenses → incompatible
- [ ] Attribution for WorldMonitor in README (it's AGPL-3.0, studied but not forked)
- [ ] Data source attributions in DATA-SOURCES.md
- [ ] No unlicensed code copied from Stack Overflow or tutorials

### Repository Setup

- [ ] Repository is **Public**
- [ ] Topics added (osint, geopolitical-analysis, etc.)
- [ ] Description set (shows on GitHub)
- [ ] Branch protection on `master` (if you want PR-only workflow)
- [ ] Discussions enabled
- [ ] Issue templates visible in New Issue dropdown
- [ ] SECURITY.md visible in Security tab

### Demo & Visual Assets

- [ ] **Live demo deployed** (Vercel hobby tier is free)
- [ ] Screenshot in `docs/images/screenshot.png` (1200×630px for social)
- [ ] GIF/video of core functionality (globe rotation, signal execution)
- [ ] Favicon and social preview image (`.github/` or `docs/images/`)

---

## 10. Post-Release Tasks

### Immediate (Week 1)

- [ ] Announce on Hacker News, Reddit, Twitter
- [ ] Monitor issues and respond within 24 hours
- [ ] Engage with first comments/stars (thank early supporters)
- [ ] Fix any critical bugs reported in first week

### Short-Term (Month 1)

- [ ] Write "How we built Atlas" blog post (technical deep dive)
- [ ] Create 2-3 tutorial videos (YouTube)
- [ ] Reach out to OSINT communities (OSINTCurious, Bellingcat)
- [ ] Submit to:
  - Awesome lists (e.g., awesome-osint, awesome-deckgl)
  - Newsletter features (JavaScript Weekly, etc.)
  - Product Hunt (if visual/demo-able)

### Long-Term (Quarterly)

- [ ] **Quarterly releases** with CHANGELOG updates
- [ ] **Contributor recognition** (top 5 contributors in release notes)
- [ ] **Roadmap updates** (GitHub Projects board)
- [ ] **Performance reviews** (bundle size, API latency)
- [ ] **Security audits** (Dependabot, manual code review)

### Metrics to Track

Use GitHub Insights + external tools:
- **Stars** (growth rate, star history chart)
- **Forks** (how many deployments?)
- **Issues** (open vs closed ratio, avg close time)
- **PRs** (contributor count, merge rate)
- **Traffic** (Vercel analytics for live demo)
- **Community** (Discussion posts, Discord members if applicable)

### Success Milestones

| Milestone | Celebration |
|-----------|-------------|
| 10 stars | Tweet screenshot |
| 100 stars | Blog post + stickers |
| 500 stars | Contributor shoutout thread |
| 1000 stars | v2.0 roadmap announcement |
| First external PR merged | Highlight in README |
| Featured in newsletter | Share on all channels |

---

## Appendix A: Quick Command Reference

### Create All Required Files

```bash
# From project root

# LICENSE (AGPL-3.0)
curl https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE

# CODE_OF_CONDUCT.md (Contributor Covenant)
curl https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md -o CODE_OF_CONDUCT.md

# CONTRIBUTING.md, SECURITY.md (copy templates from this guide)

# Create GitHub templates directory
mkdir -p .github/ISSUE_TEMPLATE
mkdir -p .github/workflows

# Issue templates (copy from section 6)

# Dependabot config
cat > .github/dependabot.yml << EOF
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
EOF
```

### Update package.json

```json
{
  "name": "atlas",
  "version": "1.0.0",
  "description": "Real-time global intelligence dashboard with geopolitical risk analysis and paper trading engine",
  "repository": {
    "type": "git",
    "url": "https://github.com/[username]/atlas.git"
  },
  "bugs": {
    "url": "https://github.com/[username]/atlas/issues"
  },
  "homepage": "https://github.com/[username]/atlas#readme",
  "license": "AGPL-3.0",
  "keywords": [
    "osint",
    "geopolitical-analysis",
    "paper-trading",
    "deckgl",
    "intelligence",
    "edge-functions",
    "vercel",
    "typescript"
  ],
  "author": "Your Name <your.email@example.com>"
}
```

---

## Appendix B: AGPL-3.0 Compliance Checklist

### For Atlas Maintainers

When **you deploy** Atlas (e.g., https://atlas.yourdomain.com):

- [ ] Source code must be publicly available (GitHub repo link)
- [ ] Provide "Download Source" link in footer or About page
- [ ] Include AGPL-3.0 notice in app (e.g., Settings → About)
- [ ] If you modify the code, push changes to public repo

### For Users Who Fork & Deploy

**They must**:
- [ ] Keep AGPL-3.0 license in their fork
- [ ] Make their modified source code available to their users
- [ ] Include a link to download source (e.g., "Fork on GitHub")
- [ ] Not remove copyright notices or license headers

**Example footer text for deployed instances**:
```
Atlas is open source under AGPL-3.0. [View Source] [Download Source Code]
```

### Enforcement

- AGPL violations can be reported to you (copyright holder)
- Friendly reminder first, legal action as last resort
- Most violations are accidental (forgotten footer link)

---

## Appendix C: Common Questions

### "Should I use AGPL-3.0 or MIT?"

**Use AGPL-3.0 if:**
- ✅ You want forks to remain open source (even when deployed as SaaS)
- ✅ You're okay with limiting commercial adoption
- ✅ Your project is primarily community-driven

**Use MIT if:**
- ✅ You want maximum adoption (companies, startups)
- ✅ You don't care if someone makes a proprietary fork
- ✅ You want to allow closed-source commercial products using your code

**For Atlas**: AGPL-3.0 is recommended because it's a web app (SaaS) and you want hosted instances to contribute back.

### "What if a company wants to use Atlas without open sourcing their modifications?"

They can:
1. **Option A**: Purchase a commercial license from you (dual licensing)
2. **Option B**: Use Atlas as-is without modifications (AGPL allows this)
3. **Option C**: Deploy modified version but make source available (complies with AGPL)

You can offer **dual licensing** later:
- AGPL-3.0 (free, open source, copyleft)
- Commercial license (paid, proprietary modifications allowed)

### "How do I handle contributions from others?"

**Contributor License Agreement (CLA)**:
- Not required for AGPL-3.0 projects (unlike dual-licensed projects)
- Contributors automatically grant license under AGPL-3.0 by submitting PR
- Mention in CONTRIBUTING.md: "By contributing, you agree your code is licensed under AGPL-3.0"

**Copyright assignment**:
- NOT recommended (creates friction for contributors)
- Use "Copyright (C) 2024-2026 Atlas Contributors" instead

---

## Final Checklist

**Before pushing to GitHub**:

- [ ] Run `npm run typecheck` (no errors)
- [ ] Run `npm run build` (successful)
- [ ] Test fresh clone locally
- [ ] Remove all API keys from git history
- [ ] README has screenshot and clear Quick Start
- [ ] LICENSE file exists (AGPL-3.0)
- [ ] CONTRIBUTING.md complete
- [ ] CODE_OF_CONDUCT.md with your email
- [ ] .env.example has all variables (no real keys)
- [ ] package.json has repository, bugs, homepage URLs

**On GitHub**:

- [ ] Repository is Public
- [ ] Topics added (10+ tags)
- [ ] Issues enabled, templates created
- [ ] Discussions enabled
- [ ] Branch protection on master (optional)
- [ ] Live demo deployed and linked in README

**Announce**:

- [ ] Hacker News (Show HN: Atlas - Global Intelligence Dashboard)
- [ ] Reddit (r/webdev, r/OSINT, r/dataisbeautiful)
- [ ] Twitter thread with screenshots
- [ ] LinkedIn post
- [ ] Dev.to article

---

**You're ready to open source Atlas!** 🚀

Good luck, and thank you for contributing to the open source community. If you have questions, feel free to reach out.

---

**Document Version**: 1.0
**Last Updated**: 2026-03-11
**Maintained By**: Atlas Core Team
