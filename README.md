# pr-reporting

The portable record of the PR reporting mechanism — fact verification,
reproduction, measurement. It is its own git branch (`pr-reporting`),
pointable from the PR text by URL.

Each report is a self-contained subdomain directory. One is known:
`bug-reproduction/` (the edit-contract bug, sst/opencode#62211). New
reports slot in as siblings.

Per-report layout: the fact base lives at the report level
(`DATA.md` — the interface; `data.sqlite` — the persistent fact base);
the work scopes live beneath it: `scaffolding/` (the disposable
machinery that establishes the population), `generate/` (the work that
reads the fact base and produces the artifact), `corpus/` (the generated
artifact — the reproduction corpus).

`binary/` — the two hosts, `old` (pre-PR) and `new` (post-PR); the
genesis workflow compiles them (AGENTS.md).
