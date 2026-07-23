# AdrianOS

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

## Product principles

- **Learning should produce evidence.** Completion alone is not mastery.
- **Interaction should carry the lesson.** The educational mechanic belongs inside the game loop.
- **Replay should deepen understanding.** New conditions should require transfer, not memorized clicking.
- **Difficulty should adapt.** Challenges should remain reachable without becoming trivial.
- **Children need agency.** The learner should make meaningful choices rather than follow a disguised worksheet.

## Engineering workflow

The repository uses pull-request-based development and automated browser validation for core learning experiences. Recent changes have added and expanded end-to-end coverage for individual labs and adventure routes.

Before merging a learning experience, verify:

- the route loads from a clean state
- keyboard and pointer interaction remain usable
- success requires the intended learning action
- incorrect choices produce useful feedback
- replay changes the challenge meaningfully
- browser reports are preserved when CI fails

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
