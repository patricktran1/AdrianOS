# AdrianOS

[![AdrianOS CI](https://github.com/patricktran1/AdrianOS/actions/workflows/adrianos-ci.yml/badge.svg)](https://github.com/patricktran1/AdrianOS/actions/workflows/adrianos-ci.yml)
[![CodeQL](https://github.com/patricktran1/AdrianOS/actions/workflows/codeql.yml/badge.svg)](https://github.com/patricktran1/AdrianOS/actions/workflows/codeql.yml)
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

## Quality gates

Every pull request that changes the application runs visible, independent checks:

| Gate | What it verifies |
| --- | --- |
| Unit tests and coverage | Catalog normalization, metadata validation, deterministic ordering, duplicate detection, and generated-source contracts |
| Static product contracts | School controls, session SDK, curriculum mapping, teaching loops, personalization, mastery loops, and elementary scope |
| Production build | A clean Next.js production compilation after generated assets and static contracts pass |
| Playwright matrix | Full browser regression coverage with traces, screenshots, video, and HTML reports retained on failure |
| CodeQL | JavaScript and TypeScript security analysis on pull requests, main, and a weekly schedule |

Coverage summaries and browser reports are uploaded as GitHub Actions artifacts. The build fails closed when unit tests, metadata contracts, product invariants, compilation, or browser regression checks fail.

## Local validation

Requires Node.js 22 or later.

```bash
cd adrianos-play-starter
npm install
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
