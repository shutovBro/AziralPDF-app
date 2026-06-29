# PDF Editor — Stage 3 (d): vector-object selection & deletion

> Design / kickoff doc. Status: **investigation complete, prototype pending.**
> Owner context: AziralPDF text editor (`frontend/editor/src/core/.../pdfTextEditor`)
> + backend `PdfJsonConversionService` / `PdfJsonFallbackFontService`.
> Slices (a) size+colour, (b) bold/italic, (c) drag-resize are SHIPPED. This is (d).

## Goal

Let the user **select and delete arbitrary vector objects** (lines, rectangles,
filled shapes, vector logos/watermarks) in the PDF editor, with the change
round-tripping to the exported PDF. Today only **text runs** and **raster
images** are modelled as editable overlays; vector graphics are baked into the
page-preview raster and are invisible to the model.

Practical note: covering a watermark/logo is **already possible** via the redact
("cover area") tool. (d) is the *true* removal — the object leaves the content
stream rather than being painted over.

## Why it is a multi-week subsystem, not a one-shot

There is no per-object vector model anywhere in the pipeline. PDF vector graphics
are sequences of content-stream operators with an implicit graphics state (CTM,
colours, clipping). To make them selectable + deletable we must introduce:

1. a backend **path-object extractor** (PDF → model),
2. a **model type** carrying each object's geometry + identity,
3. **frontend overlays** for hit-testing/selection/delete,
4. a backend **regenerate path** that omits deleted objects.

Each is a real unit of work; (1) and (4) live in the 5000-line bleeding-edge
`PdfJsonConversionService` and must not regress text/image round-tripping.

## Current architecture (verified)

- **Image extraction** uses a `PDFGraphicsStreamEngine` subclass inside
  `PdfJsonConversionService` (see `drawImage`, `computeBounds(ctm)`,
  `getGraphicsState().getCurrentTransformationMatrix()`). Its path callbacks
  (`appendRectangle`, `moveTo`, `lineTo`, `curveTo`, `getCurrentPoint`,
  `closePath`, `endPath`, `clip`, `fillPath`, `strokePath`,
  `fillAndStrokePath`, `shadingFill`) are currently **no-ops** — this is exactly
  the seam to implement for path objects.
- **Vector preservation / token rewrite**: `extractVectorGraphics(document,
  page, preservedStreams, imageElements)` + `collectVectorTokens(...)` walk a
  flat `PDFStreamParser` token list and re-emit a filtered stream via
  `ContentStreamWriter`. Text (`BT`/`ET`) and image draws are stripped; vector
  tokens kept. This is the deletion seam.
- **Regenerate gate**: pages with edits set `PdfJsonPage.regenerateContent=true`
  (added text / image changes). `regeneratePageContent(...)` redraws from the
  model; `extractVectorGraphics` supplies the kept vector layer.

## Proposed model

New record `PdfJsonVectorPath` (package `stirling.software.SPDF.model.json`):

```
id            String      // stable per extraction (sequential or UUID)
pageNumber    Integer
paintType     String      // "stroke" | "fill" | "fillStroke" | "clip" | "none"
windingRule   Integer     // NONZERO / EVEN_ODD where relevant
bbox          [x,y,w,h]   // PDF user space (device space from engine), bottom-left origin
strokeColor   PdfJsonTextColor (nullable)
fillColor     PdfJsonTextColor (nullable)
deleted       Boolean     // set by the frontend; honoured on regenerate
opIndexStart  Integer     // token range in the source stream (for deletion mapping)
opIndexEnd    Integer
```

Add `List<PdfJsonVectorPath> vectorPaths` to `PdfJsonPage` (nullable; only
populated when vector editing is requested, to avoid bloating every document).

## Backend extractor (prototype target)

New class `PdfVectorPathExtractor extends PDFGraphicsStreamEngine`:

- Track the running subpath as the engine reports `moveTo/lineTo/curveTo/
  appendRectangle` (coordinates arrive **CTM-applied** — confirm against PDFBox
  source in `~/.gradle/caches/modules-2/.../pdfbox-*.jar` before trusting; the
  image path uses the CTM explicitly via `getGraphicsState()`).
- On a painting callback (`fillPath`, `strokePath`, `fillAndStrokePath`,
  `endPath` for clip/no-op) flush the accumulated points into one
  `PdfJsonVectorPath`: compute bbox from the min/max of accumulated device-space
  points; read current non-stroking/stroking colour from
  `getGraphicsState().getNonStrokingColor()/getStrokingColor()`.
- Assign a sequential id per page so the frontend and the deletion mapper agree.

Keep it a **pure read** pass (no document mutation), mirroring the image
extractor. Wire it behind an opt-in flag/endpoint so normal conversions are
unaffected until the feature is complete.

## Backend deletion (regenerate)

When the model carries `vectorPaths` with `deleted=true`, the vector layer must
omit those objects. Two viable strategies:

1. **Token-range removal** (preferred): extend `collectVectorTokens` to also
   drop the operator runs whose path index is marked deleted. Requires the
   extractor and `collectVectorTokens` to agree on path indexing — extract once,
   record `opIndexStart/End`, then skip those ranges on rewrite.
2. **Geometry re-emit**: regenerate the vector layer entirely from the model
   (draw each non-deleted `PdfJsonVectorPath`). Cleaner model, but loses exotic
   operators (shading, clipping, blend modes) — risky for fidelity. Reject for v1.

Go with (1): identity by token range, deletion = skip range.

## Frontend

- Request vector paths when entering a new "Objects" editor mode (avoid the cost
  otherwise).
- Render one absolutely-positioned, hit-testable overlay per `PdfJsonVectorPath`
  bbox (PDF→CSS via the existing `toCssBounds` / scale helpers). Hover outline +
  click to select + ✗ to delete (mark `deleted=true`, set
  `regenerateContent=true` for the page).
- Reuse the snapshot undo/redo system (groupsByPage/imagesByPage) — add a
  `vectorPathsByPage` array to the snapshot.

## Open questions / verify first

1. **Coordinate space** of `moveTo/lineTo/curveTo/appendRectangle` in this
   PDFBox version — device vs. user space. Confirm in the jar source.
2. **Granularity**: one bbox per painting op can over-merge a complex logo into
   one giant rectangle. May need sub-path splitting or a coverage heuristic.
3. **Clipping paths** (`W`/`W*` + `n`) must NOT be deletable as visible objects.
4. **Shading/pattern fills** — represent as `paintType="fill"` with null colour;
   deletion still works via token range.
5. Performance on pages with thousands of path ops (CAD/vector-heavy PDFs).

## Milestones

- **M1 (this kickoff):** investigation + this design. ✅
- **M2:** `PdfJsonVectorPath` model + `PdfVectorPathExtractor` (read-only),
  compile-verified via server Docker build (NO prod deploy). Inert until wired.
- **M3:** opt-in extraction endpoint + frontend "Objects" mode with
  select/delete overlays (preview only).
- **M4:** token-range deletion on regenerate; round-trip verified on real PDFs.
- **M5:** polish (granularity heuristics, clip handling, perf), ship to prod.
