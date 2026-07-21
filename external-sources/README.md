# External sources

One `<provider>.yml` file per upstream org/user, listing the skills vendored
from their repos into `skills/`. Managed by `scripts/external-skills.ts` —
don't hand-edit `pinned_ref` fields, use the commands below instead.

```yaml
provider: mattpocock
skills:
  - local_name: grilling # directory name under skills/
    upstream_repo: mattpocock/skills # owner/repo
    upstream_path: skills/productivity/grilling # path within that repo
    pinned_ref: <commit sha> # exact commit the vendored copy is pinned to
    update_policy: latest # "latest" = eligible for bump-pins, "manual" = never auto-bumped
    status: active # "active" | "deprecated"
    owner: amar # who maintains this vendored copy
```

See `docs/adding-an-external-skill.md` for the workflow.
