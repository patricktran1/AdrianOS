# Contributing to AdrianOS

AdrianOS welcomes focused contributions that make learning experiences more interactive, testable, accessible, or evidence-producing.

## Start here

1. Open or choose an issue with a bounded outcome.
2. Create a branch from `main`.
3. Keep the pull request focused on one learning experience, platform capability, or quality improvement.
4. Add or update automated checks for behavior that could regress.
5. Describe the learning claim and the evidence the interaction records.

## Local setup

Requires Node.js 22 or later.

```bash
cd adrianos-play-starter
npm install
npm run dev
```

## Required checks

Before opening a pull request, run:

```bash
npm run test:unit
npm run build
```

For changes that affect a game, route, shared interaction, or learner workflow, also run:

```bash
npm run test:games
```

To create the same unit coverage summary uploaded by CI:

```bash
npm run test:coverage
```

## Adding or changing a game

A playable game should include:

- a `game.json` manifest whose slug matches its folder
- supported subject, status, age, and ordering metadata
- a route that works from a clean browser state
- keyboard and pointer access for required interactions
- useful feedback for incorrect attempts
- a completion path that requires the intended learning action
- learning evidence tied to a stable skill identifier
- replay or remix behavior when repetition is part of the experience
- Playwright coverage for the primary learning loop

The catalog generator rejects malformed metadata, unsupported subjects or statuses, mismatched slugs, and duplicate slugs.

## Pull request expectations

A strong pull request explains:

- **Outcome:** what becomes possible after the change
- **Learning behavior:** what the learner must understand or do
- **Evidence:** what automated test or observable state proves it works
- **Safety and privacy:** whether the change touches child data, profiles, analytics, or external services
- **Screenshots or recordings:** for meaningful visual changes

Do not include secrets, real child data, private educational records, or production credentials in commits, fixtures, screenshots, or issue discussions.

## Review principles

Reviewers prioritize:

1. learner safety and privacy
2. correctness of the learning interaction
3. accessibility and recoverable feedback
4. deterministic tests and explicit contracts
5. maintainable scope over ornamental complexity

Passing CI means the implementation met the repository's automated contracts. It does not validate a curriculum, establish educational efficacy, or replace teacher and caregiver judgment.
