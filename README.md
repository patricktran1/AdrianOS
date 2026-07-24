# AdrianOS

[![AdrianOS CI](https://github.com/patricktran1/AdrianOS/actions/workflows/adrianos-ci.yml/badge.svg)](https://github.com/patricktran1/AdrianOS/actions/workflows/adrianos-ci.yml)
[![CodeQL](https://github.com/patricktran1/AdrianOS/actions/workflows/codeql.yml/badge.svg)](https://github.com/patricktran1/AdrianOS/actions/workflows/codeql.yml)
[![Dependency Review](https://github.com/patricktran1/AdrianOS/actions/workflows/dependency-review.yml/badge.svg)](https://github.com/patricktran1/AdrianOS/actions/workflows/dependency-review.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/patricktran1/AdrianOS/badge)](https://scorecard.dev/viewer/?uri=github.com/patricktran1/AdrianOS)
[![Node 22](https://img.shields.io/badge/Node-22%2B-43853d)](adrianos-play-starter/package.json)

A mastery-based learning world designed to turn elementary concepts into interactive missions, experiments, and replayable adventures.

AdrianOS explores a different learning loop from passive lessons or worksheet completion:

1. enter a themed challenge
2. make decisions through play
3. receive immediate feedback
4. demonstrate understanding through action
5. replay with new conditions or difficulty

## Current experience areas

Recent development includes:

- **Adrian's Wonder Lab** for assembly, process routing, and experiment calibration
- **Human Body Explorer** as an interactive rescue laboratory
- **Treasure Map Math** as an island expedition
- **Math Motion Lab** for movement-based mathematical reasoning
- an evolving **Adventure World** home and arcade
- adaptive child-mode navigation and surprise-event systems

The active Next.js application lives in [`adrianos-play-starter`](adrianos-play-starter).

## Product principles

- **Learning should produce evidence.** Completion alone is not mastery.
- **Interaction should carry the lesson.** The educational mechanic belongs inside the game loop.
- **Replay should deepen understanding.** New conditions should require transfer, not memorized clicking.
- **Difficulty should adapt.** Challenges should remain reachable without becoming trivial.
- **Children need agency.** The learner should make meaningful choices rather than follow a disguised worksheet.

## Automated quality and supply-chain policy

Every application pull request runs one consolidated, production-shaped pipeline:

| Gate | What it verifies |
| --- | --- |
| Reproducible install | Node.js 22 and the committed nested lockfile install through `npm ci` in both jobs |
| Dependency audit | High-severity npm findings fail CI and the JSON report is retained |
| Enforced unit coverage | `scripts/lib/game-catalog.mjs` must retain 100% lines, 100% functions, and at least 95% branches |
| Static product contracts | School controls, session SDK, curriculum mapping, teaching loops, personalization, mastery loops, and elementary scope |
| Production build | A clean Next.js production compilation after generated assets and static contracts pass |
| Playwright matrix | Full browser regression coverage with build logs, traces, screenshots, video, and HTML reports retained |
| Dependency Review | Runtime and development changes are blocked on moderate-or-higher vulnerabilities and deterministic registry, integrity, and license policy |
| CodeQL | Pinned extended JavaScript and TypeScript security analysis on pull requests, `main`, and a weekly schedule |
| OpenSSF Scorecard | Default-branch and weekly analysis with OIDC publication, retained SARIF, and code-scanning upload |
| Dependabot | Weekly maintenance for the nested npm application and GitHub Actions |

The production catalog helper is tested for age normalization, metadata validation, safe defaults, deterministic ordering, duplicate slugs, and generated-source contracts.

The dependency review layer records every changed package and requires:

- npm registry provenance
- SHA-512 package integrity
- explicit approved license expressions
- no moderate, high, or critical npm audit findings

The initial frozen graph exposed vulnerable PostCSS and Sharp versions under Next. The repository now pins patched transitive versions and proves compatibility through the complete production build and browser matrix.

These controls validate software, interaction, and supply-chain behavior. They do not establish curriculum validity, educational efficacy, child-development outcomes, privacy compliance, production service levels, or suitability as a replacement for teachers and caregivers.

## Local validation

Requires Node.js 22 or later.

```bash
cd adrianos-play-starter
npm ci
npm run test:unit
npm run test:coverage
npm run build
npm run test:games
```

Run the primary non-browser gate with:

```bash
npm run validate
```

## Engineering workflow

The repository uses pull-request-based development and automated validation for core learning experiences. Before merging a learning experience, verify:

- the route loads from a clean state
- keyboard and pointer interaction remain usable
- success requires the intended learning action
- incorrect choices produce useful feedback
- replay changes the challenge meaningfully
- learning evidence records the intended skill and support level
- browser reports are preserved when CI fails

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution workflow and required checks.

## Repository map

```text
adrianos-play-starter/package-lock.json          reproducible nested npm graph
adrianos-play-starter/scripts/lib/game-catalog.mjs deterministic catalog contracts
adrianos-play-starter/scripts/run-unit-coverage.mjs enforced native coverage runner
adrianos-play-starter/test/unit/                 catalog regression fixtures
adrianos-play-starter/tests/e2e/                 complete learning-game browser matrix
scripts/review-dependency-changes.mjs            nested dependency policy and retained report
.github/workflows/adrianos-ci.yml                 audit, coverage, build, and browser evidence
.github/workflows/dependency-review.yml           blocking pull-request dependency review
.github/workflows/codeql.yml                      pinned extended security analysis
.github/workflows/scorecard.yml                   OpenSSF publication and SARIF upload
.github/dependabot.yml                            nested npm and Actions maintenance
```

## Repository focus

AdrianOS is an active prototype. It is intended to explore mastery-oriented educational product design, child-friendly interaction systems, adaptive challenge loops, and durable learning evidence.

It is not presented as a validated curriculum, assessment instrument, or replacement for teachers and caregivers.

## Related work

Patrick Tran's other maintained projects include:

- [DermBrief EvidenceOps](https://github.com/patricktran1/agihackathon26dermbrief)
- [DermPathOS / BiopsyGraph](https://github.com/patricktran1/dermpathos-biopsygraph)
- [Clinical Evidence Guardrails](https://github.com/patricktran1/clinical-ai-tools)

## Author

[Patrick Tran, MD, FAAD](https://github.com/patricktran1)
