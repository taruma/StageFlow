# StageFlow Choreography Score Catalog

This document is the authoritative Single Source of Truth (SSOT) and program guide for all built-in **Directorial Scene Studies** and **Factory Camera-Blocking Blueprints** in **StageFlow**.

It is governed by [`AGENTS.md`](../AGENTS.md) and backed by the declarative catalog manifest [`src/scores/catalog.yaml`](../src/scores/catalog.yaml).

---

## 1. Master Score Index

All built-in scores can be loaded in the StageFlow studio via URL deep-linking (`?score=<id>`), the master-detail Score Library dialog (`Library` button in header), or via the 60fps Viewport Recorder CLI (`npm run record [shortcut]`).

| Title | Category | Canonical ID (`?score=`) | CLI Shortcut / Aliases | File Path | Duration | Shots | Aspect Ratio | Media Engine | Primary Directorial Focus |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **AFRAID** | `study` | `afraid` | `afraid`, `afraid-taruma-sakti` | `src/scores/studies/afraid.yaml` | 45.4s | 16 | 16:9 | YouTube | Dramatic spatial confrontation, shallow DoF ($f/2.8$), and emotional distance staging at twilight |
| **Coordinates for Three** | `study` | `coordinates-for-three` | `coordinates-for-three` | `src/scores/studies/coordinates-for-three.yaml` | 70.0s | 20 | 16:9 | YouTube | Two-level Japanese house blocking ($Y = 0\text{m} \to 3.0\text{m}$), staircase chase, and symmetric disc activation |
| **Entropy** | `study` | `entropy` | `entropy`, `entropy-taruma-sakti` | `src/scores/studies/entropy.yaml` | 63.1s | 19 | 16:9 | YouTube | Intimate Gothic booth table debate, macro coffee-spill choreography, and exterior window push-in |
| **Frequency Over Force** | `study` | `frequency-over-force` | `frequency-over-force` | `src/scores/studies/frequency-over-force.yaml` | 68.5s | 16 | 16:9 | YouTube | Elevated lecture hall debate ($14\text{m} \times 16\text{m}$), pacing marks, and metronome focus shifts |
| **Not About Fish** | `study` | `not-about-fish` | `not-about-fish`, `not-about-fish-2026` | `src/scores/studies/not-about-fish.yaml` | 47.6s | 22 | 16:9 | YouTube | Continuous gas station walk-and-talk ($28\text{m} \times 34\text{m}$), over-the-roof debate, and sedan departure |
| **Observation Only** | `study` | `observation-only` | `observation-only` | `src/scores/studies/observation-only.yaml` | 68.0s | 18 | 16:9 | YouTube | Late-night diner booth confrontation, tight OTS coverage, and aisle walkout through swinging exit doors |
| **Screaming Amber Wood** | `study` | `screaming-amber-wood` | `screaming-amber-wood` | `src/scores/studies/screaming-amber-wood.yaml` | 65.5s | 17 | 16:9 | YouTube | Frozen root corridor ($22\text{m} \times 18\text{m}$), ritual kneeling blocking, and skull-grove awakening |
| **The Expansion** | `study` | `the-expansion` | `the-expansion`, `the-expansion-taruma-sakti` | `src/scores/studies/the-expansion.yaml` | 72.0s | 11 | 16:9 | YouTube | 72s continuous sequence shot, dynamic follow-focus, and rack-focus choreography on a basketball court |
| **The Third Passenger** | `study` | `the-third-passenger` | `the-third-passenger` | `src/scores/studies/the-third-passenger.yaml` | 83.0s | 22 | 16:9 | YouTube | Comoving train interior ($14\text{m} \times 28\text{m}$), deceleration impulse physics, bulkhead seal, and forward car twist |
| **The Unresolved Variable** | `study` | `the-unresolved-variable` | `the-unresolved-variable` | `src/scores/studies/the-unresolved-variable.yaml` | 34.8s | 18 | 16:9 | YouTube | Expansive hilltop oak staging ($36\text{m} \times 36\text{m}$), apple-toss blocking, and standing-to-seated framing |
| **Three Years Late** | `study` | `three-years-late` | `three-years-late` | `src/scores/studies/three-years-late.yaml` | 139.2s | 41 | 16:9 | YouTube | Coastal concrete overlook, 40 tripod OTS setups, 3-character vanish cut, and $85\text{mm}$ dolly pull-back |
| **Vector Field** *(Default)* | `study` | `vector-field` | `vf`, `vector-field-taruma-sakti` | `src/scores/studies/vector_field.yaml` | 61.6s | 32 | 21:9 | YouTube | Multi-actor staging, continuous dialogue tracking, speed ramps, and theatrical look-at anchor handoffs |
| **Two-Shot Arc Blocking** | `blueprint` | `demo` | `01`, `demo-blueprint`, `blueprint-01` | `src/scores/blueprints/demo_blueprint.yaml` | 10.0s | 1 | 16:9 | Simulator | Profile two-shot to over-the-shoulder (OTS) arc movement using a 50mm standard prime |
| **Cinematic Dialogue Flow** | `blueprint` | `blueprint-02` | `02`, `blueprint-02-dialogue` | `src/scores/blueprints/blueprint_02_dialogue.yaml` | 26.0s | 6 | 16:9 | Simulator | 6-shot dialogue coverage demonstrating OTS reversal, 85mm low hero arc, and Catmull-Rom spline curves |
| **The Long-Distance Pass** | `blueprint` | `blueprint-03` | `03`, `blueprint-03-ball-pass` | `src/scores/blueprints/blueprint_03_ball_pass.yaml` | 16.0s | 6 | 16:9 | Simulator | 44m × 18m spatial span, parabolic projectile kinetics, dynamic gaze tracking, and Dutch angles ($-18^\circ$ to $+22^\circ$) |
| **Cinematography & Framing** | `blueprint` | `blueprint-04` | `04`, `blueprint-04-cinematography-tutorial` | `src/scores/blueprints/blueprint_04_cinematography_tutorial.yaml` | 20.0s | 16 | 16:9 | Simulator | Framing sizes (EWS to ECU), Rule-of-Thirds lead room offsets, continuous oners, and barrel rolls |
| **Two Rooms: Threshold Crossing**| `blueprint` | `blueprint-05` | `05`, `blueprint-05-two-rooms` | `src/scores/blueprints/blueprint_05_two_rooms.yaml` | 30.0s | 17 | 2.39:1 | Simulator | Multi-actor decoupled blocking (`blocking:`) across two physical rooms with carried prop item tracking |
| **Optics, Rack Focus & DoF** | `blueprint` | `blueprint-06` | `06`, `blueprint-06-optics-dof` | `src/scores/blueprints/blueprint_06_optics_dof.yaml` | 36.0s | 8 | 2.39:1 | Simulator | Off-axis subject focus, rack focus, metric distance pulls, moving follow-focus, and iris ramping ($f/1.4 \to f/11$) |
| **Camera Rigs & Dolly Tracks** | `blueprint` | `blueprint-07` | `07`, `blueprint-07-camera-rigs` | `src/scores/blueprints/blueprint_07_camera_rigs.yaml` | 24.0s | 4 | 2.39:1 | Simulator | Stationary tripod pan tracking, linear dolly track glide with shallow DoF ($f/2.8$), and curved spline track |

---

## 2. Directorial Scene Studies (`src/scores/studies/`)

Auteur directorial scene studies authored by Taruma Sakti exploring real-world film blocking, complex multi-actor spatial relationships, and expressive cinematography (listed alphabetically by canonical slug).

### 2.1 Afraid (`afraid.yaml`)
* **Canonical Slug**: `afraid` (Aliases: `afraid-taruma-sakti`)
* **Author**: Taruma Sakti
* **Runtime**: 45.375 seconds · 16 Shots · 3 Observer Moves · 16 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=01ToYKcx8K4`)
* **Directorial Premise**: In an overgrown field at twilight, a woman confronts her partner over a secret he kept throughout their travels together.
* **Cinematographic Highlights**:
  - Dramatic spatial confrontation with two performers (Sarah and Robbie), field teasel/thistle prop clusters, and path beat markers in an open naturalistic setting ($16\text{m} \times 20\text{m}$).
  - Intense shot-reverse-shot dialogue coverage utilizing $35\text{mm}$, $50\text{mm}$, and $85\text{mm}$ primes with tight focal distances and shallow depth of field ($f/2.8$) to heighten psychological tension.

### 2.2 Coordinates for Three (`coordinates-for-three.yaml`)
* **Canonical Slug**: `coordinates-for-three`
* **Author**: Taruma Sakti
* **Runtime**: 69.958 seconds · 20 Shots · 4 Observer Moves · 34 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=yKp3APsZANM`)
* **Directorial Premise**: Full 3D two-level spatial reconstruction of "Coordinates for Three": opens with a deep-focus tatami living room tableau, breaks into a ground-floor hallway chase and wooden staircase ascent to Level 2 ($Y = 3.0\text{m}$), and culminates in a symmetric 3-person Resonance Disc activation and zero-gravity golden ascension.
* **Cinematographic Highlights**:
  - Multi-story vertical blocking across a $16\text{m} \times 12\text{m}$ Japanese house set with three actors (Ruby, Arthur, Oscar), tatami props, three-flight staircase, and an upper workshop deck.
  - Wide-to-telephoto lens progression ($22\text{mm}$–$85\text{mm}$ primes) on tripod mounts across deep, medium, and shallow DoF transitions.

### 2.3 Entropy (`entropy.yaml`)
* **Canonical Slug**: `entropy` (Aliases: `entropy-taruma-sakti`)
* **Author**: Taruma Sakti
* **Runtime**: 63.125 seconds · 19 Shots · 3 Observer Moves · 24 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=8Cbt1E1JotI`)
* **Directorial Premise**: Two men debate deterministic chaos across a rain-swept Gothic booth table while milk blooms in iced coffee.
* **Cinematographic Highlights**:
  - Contained interior table choreography ($12\text{m} \times 14\text{m}$) featuring Mark and Robert, tabletop micro-props (iced coffee glass, spill, milk pitcher, equation sheets, fountain pen), and 3-bay Gothic windows.
  - Tight dialogue coverage ($35\text{mm}$–$85\text{mm}$ primes) with shallow viewfinder DoF (`dof_blur: true`, `dof: shallow`) emphasizing tabletop focus pulls.

### 2.4 Frequency Over Force (`frequency-over-force.yaml`)
* **Canonical Slug**: `frequency-over-force`
* **Author**: Taruma Sakti
* **Runtime**: 68.5 seconds · 16 Shots · 1 Observer Move · 23 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=9yeuOPMfxPY`)
* **Directorial Premise**: Mark and Robert debate synchronization across an elevated lecture stage as a wooden metronome shifts the argument from force to resonance.
* **Cinematographic Highlights**:
  - Paced lecture-hall blocking ($14\text{m} \times 16\text{m}$) with Mark and Robert moving between floor pace spikes, the elevated stage riser, and the lecture desk.
  - Classical prime coverage ($35\text{mm}$, $50\text{mm}$, $65\text{mm}$, $85\text{mm}$, $100\text{mm}$, $105\text{mm}$) with explicit aperture shifts ($f/2.8$ to $f/5.6$) isolating the metronome centerpiece.

### 2.5 Not About Fish (`not-about-fish.yaml`)
* **Canonical Slug**: `not-about-fish` (Aliases: `not-about-fish-2026`)
* **Author**: Taruma Sakti
* **Runtime**: 47.589 seconds · 22 Shots · 5 Observer Moves · 23 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=2s_AZ4RUBNs`)
* **Directorial Premise**: Robert and Mark exit a 24-hour store, walk past fuel pumps to a parked sedan, debate a dream over the roof, and drive off.
* **Cinematographic Highlights**:
  - Large-footprint exterior travel sequence ($28\text{m} \times 34\text{m}$) transitioning from store exit through gas canopy pumps to an over-the-roof confrontation and vehicle exit.
  - Multi-focal coverage ($24\text{mm}$, $28\text{mm}$, $35\text{mm}$, $50\text{mm}$, $65\text{mm}$, $85\text{mm}$, $105\text{mm}$) across tripod setups and five macroscopic observer camera holds.

### 2.6 Observation Only (`observation-only.yaml`)
* **Canonical Slug**: `observation-only`
* **Author**: Taruma Sakti
* **Runtime**: 68.0 seconds · 18 Shots · 2 Observer Moves · 15 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=eR9TBCTyRvw`)
* **Directorial Premise**: 18-shot diner booth confrontation between Robert, Sarah, and John, culminating in John's aisle walkout.
* **Cinematographic Highlights**:
  - Three-character diner staging ($12\text{m} \times 14\text{m}$) with booth benches, counter stools, and articulated double exit doors swinging open during John's walkout beat.
  - Tight portrait primes ($35\text{mm}$–$110\text{mm}$) on tripod and dolly track rigs with shallow aperture control ($f/2.0$–$f/5.6$).

### 2.7 Screaming Amber Wood (`screaming-amber-wood.yaml`)
* **Canonical Slug**: `screaming-amber-wood`
* **Author**: Taruma Sakti
* **Runtime**: 65.542 seconds · 17 Shots · 1 Observer Move · 18 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=jbf9kY_XMEo`)
* **Directorial Premise**: Rosa defies Robert's ghost along a frozen root corridor to rip a living heart from an amber sap pool, awakening the bone-white skull grove and pulling Robert back into mortal flesh.
* **Cinematographic Highlights**:
  - Atmospheric corridor staging ($22\text{m} \times 18\text{m}$) featuring Rosa and Robert, glowing sap fissures, amber heart/pool props, and surrounding skull-canopy landmarks.
  - Expressive track and tripod camera moves ($24\text{mm}$–$72\text{mm}$ primes) at shallow-to-medium apertures ($f/2.0$, $f/2.4$, $f/2.8$).

### 2.8 The Expansion (`the-expansion.yaml`)
* **Canonical Slug**: `the-expansion` (Aliases: `the-expansion-taruma-sakti`)
* **Author**: Taruma Sakti
* **Runtime**: 72.0 seconds · 11 Continuous Camera Moves · 5 Observer Moves · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=JcF1Lffrgf8`)
* **Directorial Premise**: Stepping back-to-back across a freezing basketball court, an obsessive physicist uses his colleague to demonstrate how quickly reality pulls them apart.
* **Cinematographic Highlights**:
  - 72-second continuous sequence shot ("oner") demonstrating seamless pose chaining across all 11 shots on a $28\text{m} \times 16\text{m}$ basketball court with two characters (Frank and Dave), center court marker, and East/West hoops.
  - Spatial expansion choreography: actors stepping in opposite directions with dynamic follow-focus tracking and subject-to-subject rack focus.
  - Optical package: $24\text{mm}$, $35\text{mm}$, and $50\text{mm}$ primes with shallow Depth of Field ($f/2.8$).

### 2.9 The Third Passenger (`the-third-passenger.yaml`)
* **Canonical Slug**: `the-third-passenger`
* **Author**: Taruma Sakti
* **Runtime**: 82.958 seconds · 22 Shots · 6 Observer Moves · 33 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=Rg5qBRLZfV0`)
* **Directorial Premise**: Single-stage 3D reconstruction built in the comoving Galilean reference frame of a speeding interstellar train, moving from lounge conversation and deceleration impact to the bulkhead seal and unseen forward-car presence.
* **Cinematographic Highlights**:
  - Narrow multi-compartment train consist ($14\text{m} \times 28\text{m}$) with Ruby, Arthur, Oscar, sliding bulkhead door, Coordinate Disc, and an encroaching Erasure Void.
  - Linear trackside velocity pass, collision impulse prop blocking, and tripod/dolly coverage ($24\text{mm}$–$85\text{mm}$, $f/2.0$–$f/2.8$).

### 2.10 The Unresolved Variable (`the-unresolved-variable.yaml`)
* **Canonical Slug**: `the-unresolved-variable`
* **Author**: Taruma Sakti
* **Runtime**: 34.792 seconds · 18 Shots · 4 Observer Moves · 15 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=VJZnfNySwQA`)
* **Directorial Premise**: Mark reclines beneath a hilltop oak tossing an apple until Robert arrives, questions him, and sits beside him.
* **Cinematographic Highlights**:
  - Open hilltop landscape ($36\text{m} \times 36\text{m}$) anchored by a central oak trunk/canopy, reclining/standing/sitting actor height transitions, and parabolic apple toss blocking.
  - $35\text{mm}$, $50\text{mm}$, $85\text{mm}$, and $105\text{mm}$ prime tripod coverage across $f/2.0$–$f/2.8$ shallow-focus beats.

### 2.11 Three Years Late (`three-years-late.yaml`)
* **Canonical Slug**: `three-years-late`
* **Author**: Taruma Sakti
* **Runtime**: 139.167 seconds · 41 Shots · 5 Observer Moves · 37 Blocking Cues · Aspect Ratio: 16:9
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=b2CDM2VpsP4`)
* **Directorial Premise**: A four-character coastal overlook conversation staged within a single brutalist concrete deck: 40 locked-off setups create an intimate reunion until Rosa, Felix, and Samira vanish, leaving Evan alone for a slow $85\text{mm}$ dolly pull-back.
* **Cinematographic Highlights**:
  - Tightly bounded cliffside deck ($12\text{m} \times 12\text{m}$) with four characters (Evan, Rosa, Felix, Samira), concrete retaining wall/bench, coastal postcard, and three-segment cliffside guardrail.
  - Disciplined $30\text{mm}$–$85\text{mm}$ OTS geometry with shallow DoF (`dof: shallow`, `aperture: f/2.8`) culminating in the film's sole dolly-track pull-back.

### 2.12 Vector Field (`vector_field.yaml`)
* **Canonical Slug**: `vector-field` *(Default launch scene via `default: true`)* (Aliases: `vf`, `vector-field-taruma-sakti`)
* **Author**: Taruma Sakti
* **Runtime**: 61.625 seconds · 32 Shots · 6 Observer Moves · 13 Blocking Cues · Aspect Ratio: 21:9 Widescreen
* **Media Binding**: YouTube (`https://www.youtube.com/watch?v=1ly8QX31Uqw`)
* **Directorial Premise**: Cornered in a rural cornfield, a loyal getaway driver refuses to leave his injured partner just as their stolen relic suddenly activates.
* **Cinematographic Highlights**:
  - Demonstrates large-scale outdoor staging ($32\text{m} \times 32\text{m}$ grid) with two characters (Ruby, Evan), the Vector Disc relic prop, Cloth Wrap marker, and four cardinal glyph node markers.
  - Features rapid-fire coverage cuts ($0.8\text{s}$ to $3.5\text{s}$) paired with continuous multi-subject decoupled actor blocking.
  - Optical package: $18\text{mm}$, $24\text{mm}$, $35\text{mm}$, $50\text{mm}$, and $85\text{mm}$ primes at $f/4.0$ medium DoF.

---

## 3. Factory Camera-Blocking Blueprints (`src/scores/blueprints/`)

Synthetic educational presets designed to demonstrate and test specific StageFlow optical, mathematical, and kinematic capabilities.

### BP 01: Two-Shot Arc Blocking (`demo_blueprint.yaml`)
* **Canonical Slug**: `demo` (Shortcut: `01`)
* **Runtime**: 10.0 seconds · 1 Shot · 16:9 Gate · Procedural Media Simulator
* **Technique**: Single-shot lateral profile two-shot sweeping through a 90° circular Bezier arc into an over-the-shoulder (OTS) composition using a standard $50\text{mm}$ prime.

### BP 02: Cinematic Dialogue Flow (`blueprint_02_dialogue.yaml`)
* **Canonical Slug**: `blueprint-02` (Shortcut: `02`)
* **Runtime**: 26.0 seconds · 6 Shots · 3 Observer Moves · 16:9 Gate
* **Technique**: Classic coverage reversal between two characters featuring $85\text{mm}$ low-angle hero push-in, Catmull-Rom spline glides, and independent macroscopic diorama orbit holds (`observer_shots:`).

### BP 03: The Long-Distance Pass (`blueprint_03_ball_pass.yaml`)
* **Canonical Slug**: `blueprint-03` (Shortcut: `03`)
* **Runtime**: 16.0 seconds · 6 Shots · 16:9 Gate
* **Technique**: $44\text{m} \times 18\text{m}$ spatial span across 3 actors (Arthur, Ruby, Mark) with parabolic projectile kinetics (gravity acceleration/deceleration), centrifugal subject-following orbits, and expressive Dutch roll banking ($-18^\circ$ to $+22^\circ$).

### BP 04: Cinematography & Framing (`blueprint_04_cinematography_tutorial.yaml`)
* **Canonical Slug**: `blueprint-04` (Shortcut: `04`)
* **Runtime**: 20.0 seconds · 16 Shots · 1 Observer Move · 16:9 Gate
* **Technique**: Pedagogical framing ladder: framing sizes from Extreme Wide Shot ($18\text{mm}$) to Extreme Close-Up ($100\text{mm}$), rule-of-thirds `target_offset` headroom/lead-room biasing, continuous oners, and barrel rolls.

### BP 05: Two Rooms: Threshold Crossing (`blueprint_05_two_rooms.yaml`)
* **Canonical Slug**: `blueprint-05` (Shortcut: `05`)
* **Runtime**: 30.0 seconds · 17 Shots · 3 Observer Moves · 14 Blocking Cues · 2.39:1 Anamorphic Scope
* **Technique**: Decoupled actor blocking (`blocking:`) across two physical rooms (Living Room and Bedroom) separated by a doorway threshold. Features Ruby's 11-second continuous walk spanning Shots 07–12 with carried item prop tracking.

### BP 06: Optics, Rack Focus & DoF (`blueprint_06_optics_dof.yaml`)
* **Canonical Slug**: `blueprint-06` (Shortcut: `06`)
* **Runtime**: 36.0 seconds · 8 Shots · 2 Observer Moves · 2 Blocking Cues · 2.39:1 Scope
* **Technique**: Complete optical masterclass: off-axis focus locking with emerald tether, cinematic rack focus (`focus_start` $\to$ `focus_end`), metric distance focus pulls, dynamic follow-focus tracking on moving actors, iris aperture ramping ($f/1.4 \to f/11$), and deep focus staging.

### BP 07: Camera Rigs & Dolly Tracks (`blueprint_07_camera_rigs.yaml`)
* **Canonical Slug**: `blueprint-07` (Shortcut: `07`)
* **Runtime**: 24.0 seconds · 4 Shots · 2 Blocking Cues · 2.39:1 Scope
* **Technique**: Physical camera mounts: stationary 3-legged tripod pan tracking, linear $0.42\text{m}$ gauge dolly track with shallow DoF ($f/2.8$), fixed-gaze sideways trucking move, and curved Catmull-Rom spline rail with dynamic two-shot centroid look-at tracking.

---

## 4. Declarative Manifest Architecture (`src/scores/catalog.yaml`)

StageFlow decouples catalog registration from code. All built-in scores are declared in [`src/scores/catalog.yaml`](../src/scores/catalog.yaml):

```yaml
- id: my-scene
  file: studies/my_scene.yaml
  category: study              # "study" | "blueprint"
  date: "2026-08-23"           # Optional: ISO YYYY-MM-DD date for Recent sort
  default: true                # Optional: marks default launch scene independently of order
  aliases:
    - my-scene-alias
    - shortcut
```

- **Zero TypeScript Editing**: Adding a new score requires only adding the YAML file to `src/scores/` and declaring its entry in `catalog.yaml`.
- **Decoupled Default Selection (`default: true`)**: Setting `default: true` on a catalog entry designates the default launch scene (`getDefaultCatalogItem()`) independently of alphabetical/display order (`vector-field` sits 12th alphabetically while remaining the default launch scene).
- **Build-Time Metadata Index & Lazy YAML Chunking**: [`vite-plugin-score-catalog.ts`](../vite-plugin-score-catalog.ts) parses `catalog.yaml` and extracts lightweight metadata (`id`, `file`, `category`, `date`, `aliases`, `isDefault`, `title`, `subtitle`, `videoUrl`, `durationSec`, `shotCount`, `aspectRatio`) at build/dev startup into `virtual:stageflow-catalog-index`. [`src/core/scoreCatalog.ts`](../src/core/scoreCatalog.ts) pairs that index with lazy `import.meta.glob('../scores/{studies,blueprints}/**/*.yaml', { query: '?raw', import: 'default', eager: false })` YAML chunks so only the active score is parsed on initial load while remaining bundled scores load and cache on demand (`loadBundledScore`, `loadAllBundledScores`).
- **Deep Linking**: The showrunner-defined `id` serves directly as the canonical URL query parameter (`?score=my-scene`), while `aliases:` provide 100% backwards compatibility for legacy identifiers.

