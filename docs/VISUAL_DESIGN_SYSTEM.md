# Visual Design System Specification

This document is the authoritative Single Source of Truth (SSOT) for the **Visual Design System**, styling tokens, typography, theme engine, and aesthetic invariants in **StageFlow**. It is governed by [`AGENTS.md`](../AGENTS.md) and pairs with [`docs/DIORAMA_3D_AND_UI_SPECIFICATIONS.md`](DIORAMA_3D_AND_UI_SPECIFICATIONS.md).

---

## 1. Design Philosophy & Creative Suite Parity

StageFlow is designed to feel like a high-end, tactile director's diorama and architectural blueprint desk. It aligns visually with its sister application **SceneFlow**, sharing:
- **Physical Stationery Aesthetic**: Tactile pill-shaped chrome, elevated surfaces with subtle shadows, and crisp division borders (`border-border-main`).
- **Quiet, Functional Restraint**: The interface steps back so that the universal video player, 3D spatial staging, camera frustums, and blocking trajectories remain the primary focus.
- **Instantaneous Responsiveness**: Theme swaps, split resizes, and camera cuts occur with **zero animation stutter and zero 60fps WebGL frame drops**.

---

## 2. Typographic Hierarchy

StageFlow pairs three distinct font families loaded in [`index.html`](../index.html) to establish an unmistakable editorial and technical hierarchy:

| Font Family | Classification | Role & Usage | Tailwind Class |
| :--- | :--- | :--- | :--- |
| **`Libre Baskerville`** | Editorial Serif | Key brand identity headings, modal titles, literary emphasis, and directorial titles | `font-serif` |
| **`Inter`** | Geometric Sans-Serif | Primary UI chrome, button labels, navigation pills, descriptions, and modal body text | `font-sans` |
| **`JetBrains Mono`** | Technical Monospace | Precision telemetry (degrees, meters, focal lengths), timecodes, shot badges, and live YAML score editing | `font-mono` |

---

## 3. App Shell Themes & CSS Variables (`src/index.css`)

The 2D application shell supports 4 distinct theme modes managed by [`useAppShellTheme.ts`](../src/hooks/useAppShellTheme.ts) and persisted in `localStorage` (`stageflow:ui:theme-mode`):

```text
stageflow:ui:theme-mode = 'light' | 'warm' | 'dark' | 'auto'
```

When set to `'auto'`, the active category dynamically follows the user's OS preference (`prefers-color-scheme`).

### Semantic Color Variables

All UI components reference semantic CSS custom properties defined in [`src/index.css`](../src/index.css):

| CSS Variable | Role & Application |
| :--- | :--- |
| `--app-bg` | Root application background beneath split viewports and headers |
| `--surface` | Elevated card surfaces (modals, dropdown menus, transport bar, video card) |
| `--surface-subtle` | Secondary surface fills (table rows, inactive pills, drawer sidebars) |
| `--surface-muted` | Muted background fills (disabled buttons, empty state backgrounds) |
| `--surface-hover` | Interactive hover surface fill |
| `--border-main` | Primary structural borders dividing viewports, cards, and modal headers |
| `--border-subtle` | Secondary internal row and header dividers |
| `--text-main` | High-contrast body text and prominent titles |
| `--text-body` | Primary interactive item and prose copy |
| `--text-muted` | Secondary labels, descriptions, and inactive tabs |
| `--text-faint` | Monospace timestamps, telemetry sub-labels, and subtle captions |
| `--btn-primary-bg` / `--btn-primary-text` | Primary interactive button and active chip surface/text tokens |

### Theme Palettes Matrix

| Theme Mode | Intent & Visual Atmosphere | `--app-bg` | `--surface` | `--border-main` |
| :--- | :--- | :--- | :--- | :--- |
| **`Light`** (Default) | **Clean Warm Stone**: High-clarity editorial daylight | `#f5f5f4` | `#ffffff` | `#e7e5e4` |
| **`Warm`** | **Architectural Drafting Paper**: Ivory and cream stationery | `#f3efe6` | `#faf7f0` | `#dfd7c5` |
| **`Dark`** | **Warm Obsidian Studio**: Low eye-strain, cinematic diorama contrast | `#0c0a09` | `#171514` | `#2c2825` |
| **`Pure Black`** | **OLED Blueprint Void**: Pitch black (`[data-pure-black-shell="true"]`) | `#000000` | `#000000` | `#242424` |

---

## 4. Centralized `UI_TOKENS` (`src/ui/tokens/ui.ts`)

To prevent inline class duplication and ensure uniform physical stationery styling across all components, StageFlow centralizes its design tokens in [`src/ui/tokens/ui.ts`](../src/ui/tokens/ui.ts):

### 4.1 Layout Shells
- `UI_TOKENS.layout.appHeader`: 3-wing header bar with `relative z-30`, tactile bottom border, and theme-aware surface fill.
- `UI_TOKENS.layout.leftPanelBase` / `.rightPanelBase`: Base flex column containers for split workspace panels.
- `UI_TOKENS.layout.sectionTitle` / `.sectionTitleMini`: Monospace uppercase section titles with wide tracking and faint tone.

### 4.2 Modal Dialogs
- `UI_TOKENS.modal.containerSm`, `.containerMd`, `.containerLg`, `.containerLibrary`, `.containerStaging`: Standardized accessible modal wrappers with responsive width clamps and tactile borders.
- `UI_TOKENS.modal.header` / `.headerSubtle`: Title row with status chips and close button.
- `UI_TOKENS.modal.footer`: Bottom action row with secondary/primary button alignment.
- `UI_TOKENS.modal.overlay` / `.overlayHeavy`: Translucent backdrop (`bg-overlay-bg` / `bg-overlay-heavy backdrop-blur-sm`).

### 4.3 Dropdowns & Menus
- `UI_TOKENS.dropdown.menu`, `.menuRight`, `.menuWide`: Floating elevated menu panels with tactile border and shadow.
- `UI_TOKENS.dropdown.header` / `.headerText`: Monospace section category dividers.
- `UI_TOKENS.dropdown.item` / `.itemActive`: Interactive menu rows with hover accent and active state.

### 4.4 Tactile Buttons, Pills & Inputs
- `UI_TOKENS.button.primary`, `.secondary`, `.danger`: Modal and form action buttons.
- `UI_TOKENS.button.actionPill` / `.actionPillActive`: Compact uppercase tracking pills for toolbar triggers.
- `UI_TOKENS.button.filePill` / `.filePillActive`: Stationery pills for `File ▾` and active score chips.
- `UI_TOKENS.button.libraryPop` / `.libraryPopActive`: Distinct gateway buttons for the Score Library.
- `UI_TOKENS.button.segmentedGroup`, `.segmentedItem`, `.segmentedItemActive`: Segmented pill containers and items for workspace layout and camera POV switchers.
- `UI_TOKENS.input.search`, `.numberBox`, `.label`, `.labelMini`: Standardized search inputs, numeric boxes, and uppercase form labels.

### 4.5 Visual Score Editor Inspector Tokens (`UI_TOKENS.inspector`)
- `sectionCard`, `sectionHeader`, `sectionHeaderCollapsed`, `itemCard`, `itemCardActive`: Theme-adaptive stationery cards for top-level YAML sections and individual shot/entity/blocking/observer items.
- `fieldRow`, `scrubPill` (`scrubPillIdle` / `scrubPillActive` / `scrubPillDisabled`), `textInput`, `selectTrigger`, `portalMenu`, `treeRail`, `timingBar`, `addPropBtn`: 2-column CSS property-grid rows, `FigmaNumberPill` states, tree indentation rails, and headless `@radix-ui/react-popover` / `@radix-ui/react-select` portal surfaces styled strictly from semantic CSS theme variables across all 4 StageFlow themes.

---

## 5. Decoupled 3D Diorama Stage Palette (`src/stage/dioramaTheme.ts`)

### 5.1 Directorial Rationale
In film and choreography staging, users frequently prefer reading scripts, authoring notes, or browsing project files in a warm or light stationery interface while keeping the 3D diorama stage in a **high-contrast dark blueprint void**. Keeping the 3D void dark preserves:
1. Visibility of luminous camera cones, rectangular frustum gate lines, and target tether lines.
2. Distinct visual contrast for white eye-visor directional cones on character mannequins.
3. Uncluttered depth fog perception across the stage perimeter.

Therefore, the 3D Diorama Stage Theme is **strictly decoupled** from the 2D App Shell Theme and persisted independently via `localStorage` (`stageflow:ui:diorama-theme-mode`):

```text
stageflow:ui:diorama-theme-mode = 'match-app' | 'light' | 'warm' | 'dark'
```

- **`match-app` (Default)**: Dynamically links the diorama floor to the active app shell theme category (defaults to Light Clean Warm Stone).
- **`light`**: Sets the diorama floor to clean warm stone.
- **`warm`**: Sets the diorama floor to ivory architectural drafting paper.
- **`dark`**: Preserves the obsidian blueprint diorama void regardless of whether the app shell is light or warm.

### 5.2 WebGL Dynamic Palette Evaluation

The active diorama colors are computed purely in JavaScript via [`getDioramaThemeColors(effectiveCategory)`](../src/stage/dioramaTheme.ts) and applied directly to R3F materials with **zero extra WebGL draw calls or shader passes**:

| Palette Element | Dark Mode | Warm Mode | Light Mode |
| :--- | :--- | :--- | :--- |
| **Clear Color / Background (`bg`)** | `#0c0a09` | `#f3efe6` | `#f5f5f4` |
| **Depth Fog (`fog`, `45m`–`160m`)** | `#0c0a09` | `#f3efe6` | `#f5f5f4` |
| **Ground Plane Floor (`floorColor`)** | `#171514` | `#faf7f0` | `#ffffff` |
| **Primary Section Grid (`gridSection`, 1m)** | `#2c2825` | `#cfc4af` | `#d6d3d1` |
| **Minor Sub-Grid (`gridCell`, 0.25m)** | `#1c1917` | `#e4dccb` | `#e7e5e4` |
| **Stage Perimeter Frame (`borderLine`)** | `#38bdf8` (Cyan) | `#9e8c75` (Muted Warm) | `#78716c` (Muted Stone) |
| **Axis Crosshair & Reticle (`axisLine`)** | `#38bdf8` (Cyan) | `#b5a48d` (Muted Warm) | `#a8a29e` (Stone Grey) |

---

## 6. Performance & Interaction Invariants

### 6.1 Transition Freezing (`disableTransitionsTemporarily()`)
Changing themes across a heavy WebGL diorama and complex 2D UI tree can cause multi-frame CSS transition reflow lag. StageFlow eliminates this via `disableTransitionsTemporarily()` in [`src/hooks/useAppShellTheme.ts`](../src/hooks/useAppShellTheme.ts):
- Injects `.disable-theme-transitions * { transition: none !important; }` onto the root document for 1 animation frame during theme swaps.
- Guarantees instantaneous color swapping with **zero animation stutter and zero dropped frames**.

### 6.2 60fps Split Resize Performance (`body.is-resizing-split`)
When dragging the split workspace divider bar between the video player and 3D diorama:
- [`ResizableSplitWorkspace.tsx`](../src/ui/ResizableSplitWorkspace.tsx) adds `is-resizing-split` to `document.body`.
- This temporarily disables CSS transitions and suppresses iframe pointer interception (`pointer-events: none` on `<iframe />` elements).
- Eliminates pointer capture loss over YouTube iframes and maintains a locked **60fps divider resizing experience**.

### 6.3 Stacking Context Isolation & 3D Billboard Label Layering
To prevent Three.js Drei `<Html>` elements from colliding with or occluding 2D UI chrome:
- **Calibrated Z-Index Range**: [`StageBillboardLabel.tsx`](../src/stage/StageBillboardLabel.tsx) restricts `<Html>` depth sorting to a 5-tier band strictly within `zIndexRange={[8, 0]}` (`camera: [8, 7]`, `highlighted: [6, 5]`, `character: [4, 3]`, `prop: [2, 1]`, `marker: [1, 0]`). Higher-priority elements (Stage Camera and active focus subjects) render reliably above secondary props and markers in 3D space, while remaining strictly beneath 2D viewport HUDs (`z-10`) and bottom telemetry capsules (`z-20`).
- **Viewport Stacking Isolation**: The 3D diorama container in [`ResizableSplitWorkspace.tsx`](../src/ui/ResizableSplitWorkspace.tsx) enforces `isolation: isolate`, confining all 3D canvas HTML DOM projections inside a discrete stacking context.
- **Authoritative Studio Header**: The top header (`WorkspaceHeader.tsx`) enforces `relative z-30`, ensuring all navigation dropdowns (`File ▾`, `Color Themes ▾`) and modal overlays (`z-[100]`) render authoritatively above the 3D diorama canvas.

---

## 7. Compact Grid & On-Demand Inspector Score Library Architecture

The Choreography Score Library ([`ScoreLibraryModal.tsx`](../src/ui/ScoreLibraryModal.tsx)) implements a spacious `max-w-6xl` studio hub optimized for zero-scroll browsing across large catalogs (10–50+ scores):

### 7.1 Full-Width Compact Grid & Filter/Sort Toolbar (`ScoreLibraryToolbar.tsx`, `ScoreLibraryGridBody.tsx`)
- **4-Way Category Tabs**: Segmented category selector (`All`, `Custom`, `Studies`, `Blueprints`) prioritizing user projects alongside bundled work.
- **Zero-Cost Filter & Sort Strip (`scoreCatalogFilters.ts`)**: Evaluates purely in-memory against `ScoreCatalogItem` metadata without parsing YAML:
  - **Source Filter**: `All`, `YouTube`, `Sim / Local`.
  - **Aspect Ratio Filter**: `All`, `16:9`, `Scope` (`2.39:1` / `21:9`), plus `Other` when `4:3` / `1:1` / `9:16` items exist.
  - **Directional Sort**: `Recent` (IndexedDB `updatedAt` + `catalog.yaml` `date`), `A–Z`, `Duration`, and `Shots`, paired with an ascending/descending direction toggle (`↑` / `↓`).
- **3-Column Responsive Grid (`Details OFF` default)**: Uses the full modal width (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, or `1–2` columns when `Details` is toggled ON).
- **Ultra-Compact 2-Line Card (`ScoreLibraryCard.tsx`, `~46px`)**: Fits 15–18+ projects in a single viewport without scrolling:
  - **Line 1 (Identity)**: Unified category tag (`CUSTOM` in Warm Amber, `STUDY` in Violet, `BP 01`–`BP 07` in Sky Blue), `Inter` (`font-sans text-xs font-semibold`) title, optional `Active` chip, and hover `ⓘ` inspect trigger.
  - **Line 2 (Telemetry)**: Precision `JetBrains Mono` (`font-mono text-[10px]`) delimited string displaying media badge (`Sim`, `YT`, `Video`), duration (`30.0s`), shot count (`17sh`), and aspect ratio (`16:9`, `2.39:1`, `21:9`).
- **Custom-First Collapsible Sections**:
  - In the `All` tab, sections render in priority order: `CUSTOM PROJECTS` (expanded default), `SCENE STUDIES` (expanded default), and `BLUEPRINTS` (collapsed default; auto-expands whenever search or filters are active).
- **2D Keyboard Traversal & Safe Desktop Loading**:
  - Single-click selects a card; double-click or `Enter` loads it into the studio and closes the modal.
  - `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` step across grid rows/columns, `/` focuses search, `I` toggles the Details Inspector, and `Esc` clears active search or closes the dialog.

### 7.2 On-Demand Choreography Inspector (`ScoreInspectorPane.tsx`) & Compact Footer (`ScoreLibraryFooter.tsx`)
- **Collapsed by Default (`stageflow:ui:library-show-details`)**: Keeps the library calm and fast while browsing; [`ScoreLibraryFooter.tsx`](../src/ui/library/ScoreLibraryFooter.tsx) exposes `Fork to Edit`, `Duplicate`, `Rename`, `Export`, `Delete`, and `Load into Studio →` directly below the grid.
- **On-Demand Sidecar (`Details ON`)**: Clicking `[ Details ]`, pressing `I`, or clicking a card's `ⓘ` icon opens [`ScoreInspectorPane.tsx`](../src/ui/library/ScoreInspectorPane.tsx) and lazily loads the full YAML/AST (`onEnsureScoreLoaded`):
  - **Directorial Metadata & Notes**: Un-truncated title, optional `YYYY-MM-DD` date pill, full directorial notes, and media engine indicators.
  - **Procedural 2D Vector Stage Minimap (`ScoreStageMinimap.tsx`)**: Renders an instantaneous top-down SVG blueprint schematic of stage geometry, character proxies with facing chevrons, oriented bounding box polygons for box props, elliptical footprints, and camera trajectory cones in $< 0.1\text{ms}$ with zero WebGL overhead.
  - **Optical & Staging Grid**: 4-quadrant display of duration, shot count, film gate aspect ratio, and entity count.
  - **Shot Coverage Strips & Unified Lifecycle Controls**: Sequential camera breakdown alongside inline renaming, duplication, YAML export, and deletion.
