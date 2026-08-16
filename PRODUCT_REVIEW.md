# Beacon product review

Expert take (August 2026). Short version. Use this as the backlog; keep install docs in [`README.md`](README.md).

---

## Verdict

Beacon already works as a **single-VPS** panel (sites, deploys, GitHub, TLS, PHP/Node, MySQL, workers, console, self-update).

Do **not** chase multi-server or teams next. Fix safety holes, then make day-to-day ops easier without SSH.

| Strength | Gap |
|----------|-----|
| Wrapper security model | Cron / isolation footguns |
| Site + deploy loop | No log viewer |
| MySQL + remote toggle | No import/restore |
| GitHub App | Thin metrics / alerts |

---

## Do next (in order)

### 1. Harden
- Fix [security gaps](README.md#security-gaps) (cron validation, path allow-list, secure cookies, mask DB passwords, no `MYSQL_PWD` in `ps`, CSP, throttles, console activity log)
- Keep typed confirm on delete site/DB

### 2. Operate
- Site log viewer (nginx / PHP / Beacon logs)
- Database import / restore
- Firewall UI + manual public IP override
- Dashboard: cert expiry, disk warning, remote MySQL “port open” badge

### 3. Deploy better
- Optional zero-downtime (release folder + symlink)
- Health-check URL before “success”
- Split `sites/show.tsx`; remove leftover Beacon vs Forge dual UI

### 4. Later
- Redis status, failed-queue peek, alerts
- Postgres, API tokens, recipes
- Multi-server / teams / per-site UNIX users (v2)

### Skip for now
Docker-first, WordPress product, full APM, billing/SaaS, in-browser SSH.

---

## Feature cheat sheet

| Area | Call |
|------|------|
| Sites / deploys / TLS / GitHub | Keep; polish errors |
| Remote MySQL toggle | Keep; off by default |
| Cron | Fix validation first |
| Console | Log it in Activity |
| Databases | Add import/restore |
| Workers | Add failed-job peek later |
| Metrics | Host only is fine for now |
| Redis / firewall / API | Add after Harden + Operate |

---

## Architecture (keep)

- `beacon-panel` sudo → wrappers only  
- `beacon` has no sudo  
- SQLite for the panel  
- Fake `ProcessRunner` in tests  

New root powers = new `beacon-*` wrapper, never raw `sudo` from PHP.

---

## One-line strategy

**Be the best “one VPS I own” panel** — safer and clearer than Forge clones that pretend to be fleets.
