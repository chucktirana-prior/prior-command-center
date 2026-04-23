# Location Monitor Implementation Plan

## Goal

Redesign the current Location Monitor into a more robust editorial maintenance system that does not depend solely on Google Maps.

The new system should use:

1. Contentful as the live article inventory
2. Website evidence as the default automated verification layer
3. Claude as the judgment layer for ambiguous cases
4. Google Maps as optional enrichment, not the only source of truth

## Current State

Working now:
- Contentful import of linked businesses from article bodies
- SQLite storage for tracked places
- manual Google Maps check routes and UI

Current limitations:
- Google Maps is required for meaningful checks
- no website health checks
- no editorial interpretation layer
- no way to distinguish dead website vs changed venue vs ambiguous case
- no AI review summaries

## New Model

### Layer 1: Inventory
- import all external linked businesses from live Contentful articles
- store article context, section, source link text, and website URL
- keep historical place rows up to date as articles change

### Layer 2: Evidence
- fetch the linked website directly
- record:
  - HTTP status
  - final URL after redirects
  - page title
  - redirect count
  - whether the page appears reachable
  - whether the page looks like a booking/contact form instead of a venue
  - lightweight closure/change signals from page text
- optionally add Google Maps evidence if configured

### Layer 3: Review
- deterministic rule pass first:
  - dead site
  - redirect mismatch
  - suspicious inquiry/booking endpoint
  - likely closure language
- Claude review second for ambiguous cases
- output:
  - review status
  - confidence
  - short explanation
  - recommended editorial action

### Layer 4: Editorial Output
- show places needing review
- show articles with multiple risky places
- show recommended actions:
  - leave as is
  - verify manually
  - replace link
  - update copy
  - remove venue

## Phase Breakdown

### Phase 1: Website Evidence
- add website evidence fields/tables
- implement website fetch and evidence storage
- add API route to run website checks
- update Location Monitor UI to show website evidence

### Phase 2: AI Review
- build structured Claude review service for location evidence
- persist AI review summary and action recommendation
- expose AI review in API and UI

### Phase 3: Editorial Prioritization
- article-level risk summaries
- stale guide prioritization
- bulk “needs review” filters

### Phase 4: Optional Enrichment
- keep Google Maps checks as a secondary verifier
- merge Maps signals into the same evidence model

## Near-Term Deliverable

The first implementation slice in this branch should deliver:
- Contentful import still working
- website evidence checks stored in SQLite
- new API endpoints for website checks
- location summary showing website-check readiness and results
- groundwork for Claude review on top of stored evidence
