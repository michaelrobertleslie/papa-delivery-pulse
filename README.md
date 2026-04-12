# PAPA Delivery Pulse

A Dynatrace platform app for real-time delivery health tracking of Platform Apps value increments.

## What It Does

- **Dashboard** — Portfolio overview, FV/Sprint changes, delivery status changes, items entering implementation, stale item detection
- **VI Explorer** — Full list of all PAPA value increments with sorting

## Data Source

All data comes from `jira_daily.valueincrement` bizevents in Grail — daily snapshots of Jira value increments ingested by the Jira-to-Grail pipeline. The app compares earliest vs latest snapshots within a configurable window to detect changes.

## Getting Started

```bash
# Start development server (opens in your Dynatrace environment)
npx dt-app dev

# Deploy to your environment
npx dt-app deploy
```

## Environment

- **App ID**: `my.papa.delivery.pulse`
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`

## Architecture

```
src/app/
├── App.tsx               # Router setup (/ → Dashboard, /explorer → Explorer)
├── queries.ts            # All DQL queries (shared, 11 query functions)
├── components/
│   ├── Header.tsx        # Navigation header
│   └── Card.tsx          # Reusable card component
└── pages/
    ├── Dashboard.tsx     # Main delivery health dashboard
    └── Explorer.tsx      # Full VI list with sorting
```

## Built With

- [Dynatrace App Toolkit](https://developer.dynatrace.com/develop/app-toolkit/) (`dt-app`)
- [Strato Design System](https://developer.dynatrace.com/develop/ui/) (React components)
- [Grail / DQL](https://docs.dynatrace.com/docs/platform/grail/dynatrace-query-language) via `@dynatrace-sdk/react-hooks`
- GitHub Copilot (AI-assisted development)
