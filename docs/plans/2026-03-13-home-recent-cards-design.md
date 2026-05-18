# Home Recent Cards Design

## Objective

Align the "Memoria recente" cards on the home sanctuary page with the visual pattern already used in the history page.

## Approved Scope

- Replace the text-only tarot card blocks on the home page with the same image-based card preview used in history.
- Keep the rest of the home recent-reading card layout unchanged.
- Show up to three cards per reading, with image and card name below each one.

## Design

- The recent readings section on the home page will reuse the same visual structure already present in the history list:
  - `picture` element
  - AVIF/WEBP source selection via `getCardImageCandidates`
  - fallback image source
  - card name caption under the image
- The home section remains more compact overall, but the card preview area should match the history presentation so the UI is visually consistent across both surfaces.

## Implementation Notes

- Update [sections.tsx](/C:/Users/breno/Documents/projects/Mystica/src/app/sections.tsx) to import and use `getCardImageCandidates`.
- Replace the current text-box rendering in `RecentReadingsSection` with the same picture-based markup pattern used in [sections.tsx](/C:/Users/breno/Documents/projects/Mystica/src/app/history/sections.tsx).
- Add or update a targeted test to assert that the recent readings section renders the actual image card preview structure instead of only text placeholders.
