---
type: domain model
title: Fermentation profiles
description: Profile schema, validation, formula evaluation, starter data, and profile CRUD used to create reproducible batches.
tags: [domain, profiles, formulas]
---

`src/domain/profiles.ts` defines `FermentationProfile`: guidance, metric inputs, calculations, recurring checks, pH zones, temperature bounds, and expected duration. `createProfileState` seeds Kombucha F1, Kimchi, Sauerkraut, Milk kefir, and Sourdough starter profiles.

`normalizeProfile` accepts legacy string guidance/instructions, while `cloneProfile` deep-copies nested arrays and normalizes every profile-check ID; this is the normalization boundary before a profile is snapshotted into a batch. Batch creation copies the profile and its checks, so later profile edits do not mutate existing batches. In the editor, `availableSourceTerms` excludes calculation-only result names from formula sources while `availableResultTerms` prevents duplicate result selection. `parseSimpleFormula` recognizes `input operator number[%]`; `calculateProfileValue` also evaluates the supported expression grammar with unit-family tracking. Mass (`g`, `kg`) and volume (`ml`, `l`) are converted to base scales; incompatible output families, division by zero, negative results, unknown inputs, and invalid percentages fail explicitly.

`validateProfile` enforces identifier-safe unique input names, nonnegative defaults, valid durations and temperatures, unique calculations/checks, valid intervals, and ordered non-overlapping pH zones. `addProfile`, `updateProfile`, and `deleteProfile` are the CRUD boundary used by the editor in `App.tsx`; profile state is parsed by `src/platform/profile-store.ts` and validated again for archive import.

Evidence: `src/domain/profiles.ts`. Focused tests in `src/domain/profiles.test.ts` cover formula parsing/evaluation, unit conversion, malformed formulas, validation errors, normalization, and CRUD. A profile change must update the editor, profile parser, batch snapshot assumptions, archive validation, and that suite.
