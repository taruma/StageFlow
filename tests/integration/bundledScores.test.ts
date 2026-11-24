import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import {
  getDefaultCatalogItem,
  loadAllBundledScores,
  loadBundledScore,
} from '../../src/core/scoreCatalog';

const ALL_LOADED_SCORES = await loadAllBundledScores();

describe('Bundled Choreography Scores — Catalog & Blueprint Regression Suite', () => {
  it('registers and organizes scene studies and factory blueprints with distinct categories', () => {
    expect(ALL_LOADED_SCORES).toHaveLength(19);

    const studies = ALL_LOADED_SCORES.filter((item) => item.category === 'study');
    const blueprints = ALL_LOADED_SCORES.filter((item) => item.category === 'blueprint');

    expect(studies).toHaveLength(12);
    expect(blueprints).toHaveLength(7);

    const studyIds = studies.map((item) => item.id);
    expect(studyIds).toEqual([...studyIds].sort((a, b) => a.localeCompare(b)));
    expect(studyIds[0]).toBe('afraid');
    expect(studyIds[studyIds.length - 1]).toBe('vector-field');

    const defaultItem = getDefaultCatalogItem(ALL_LOADED_SCORES);
    expect(defaultItem.id).toBe('vector-field');
    expect(defaultItem.aliases).toContain('vector-field-taruma-sakti');

    for (const item of ALL_LOADED_SCORES) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.score).toBeDefined();
      expect(item.rawYaml).toBeTruthy();
      expect(['study', 'blueprint', 'custom']).toContain(item.category);
    }
  });

  it('verifies all catalog items parse identically without errors (Golden Equivalence)', () => {
    expect(ALL_LOADED_SCORES).toHaveLength(19);
    for (const item of ALL_LOADED_SCORES) {
      expect(item.score).toBeDefined();
      expect(item.score.shots.length).toBeGreaterThan(0);
      expect(item.score.durationSec).toBeGreaterThan(0);
      expect(item.score.stage.width).toBeGreaterThan(0);
      expect(item.score.stage.depth).toBeGreaterThan(0);
    }
  });

  it('asserts Golden Frame Equivalence across all 19 bundled scene scores at multi-timestamps', () => {
    for (const item of ALL_LOADED_SCORES) {
      const score = item.score;
      const duration = score.durationSec;
      const testTimestamps = [0.0, duration * 0.25, duration * 0.5, duration * 0.75, duration];

      for (const t of testTimestamps) {
        const frame = computeStageFrame(t, score);
        expect(Number.isFinite(frame.stageCamera.transform.position.x)).toBe(true);
        expect(Number.isFinite(frame.stageCamera.transform.position.y)).toBe(true);
        expect(Number.isFinite(frame.stageCamera.transform.position.z)).toBe(true);
        expect(Number.isFinite(frame.observerCamera.transform.position.x)).toBe(true);
        expect(Number.isFinite(frame.observerCamera.transform.position.y)).toBe(true);
        expect(Number.isFinite(frame.observerCamera.transform.position.z)).toBe(true);
        expect(frame.stageCamera.transform.fovDeg).toBeGreaterThan(10);
        expect(frame.stageCamera.transform.fovDeg).toBeLessThan(120);
      }
    }
  }, 20000);

  it('validates Three Years Late observer camera continuity at shot boundaries', async () => {
    const { score } = await loadBundledScore('three-years-late');
    const boundaryTimes = [59.083, 91.167, 112.667];

    for (const t of boundaryTimes) {
      const before = computeStageFrame(t - 0.001, score).observerCamera.transform.position;
      const after = computeStageFrame(t + 0.001, score).observerCamera.transform.position;
      const jumpDist = Math.hypot(
        after.x - before.x,
        after.y - before.y,
        after.z - before.z
      );
      expect(jumpDist, `Observer eye jump at ${t}s`).toBeLessThan(0.05);
    }
  });

  it('validates Observation Only smooth John walkout and swinging exit doors at 58.1s..59.0s', async () => {
    const { score } = await loadBundledScore('observation-only');

    const johnBefore = computeStageFrame(58.099, score).entitiesById.get('john')!.position;
    const johnAfter = computeStageFrame(58.101, score).entitiesById.get('john')!.position;
    const johnJump = Math.hypot(
      johnAfter.x - johnBefore.x,
      johnAfter.y - johnBefore.y,
      johnAfter.z - johnBefore.z
    );
    expect(johnJump).toBeLessThan(0.05);

    const fDoorsOpen = computeStageFrame(59.0, score);
    const doorLeft = fDoorsOpen.entitiesById.get('exit_door_left')!;
    const doorRight = fDoorsOpen.entitiesById.get('exit_door_right')!;
    expect(Math.abs(doorLeft.rotationYRad)).toBeGreaterThan(1.0);
    expect(Math.abs(doorRight.rotationYRad)).toBeGreaterThan(1.0);
  });

  it('validates Blueprint 02 full timeline continuity and shot cut integrity across all 6 film shots', async () => {
    const bp2Item = await loadBundledScore('blueprint-02');
    expect(bp2Item).toBeDefined();
    const score = bp2Item.score;

    expect(score.shots).toHaveLength(6);
    expect(score.observerShots).toHaveLength(3);

    const fBeforeCut1 = computeStageFrame(4.99, score);
    const fAtCut1 = computeStageFrame(5.0, score);
    expect(fBeforeCut1.stageCamera.shotId).toBe('shot-1');
    expect(fAtCut1.stageCamera.shotId).toBe('shot-2');
    expect(fBeforeCut1.stageCamera.transform.pose.focalLengthMm).toBe(35);
    expect(fAtCut1.stageCamera.transform.pose.focalLengthMm).toBe(50);

    expect(fBeforeCut1.observerCamera.shotId).toBe('obs-move-1');
    expect(fAtCut1.observerCamera.shotId).toBe('obs-move-1');
    expect(
      Math.abs(fAtCut1.observerCamera.transform.pose.yaw - fBeforeCut1.observerCamera.transform.pose.yaw)
    ).toBeLessThan(0.05);

    const fBeforeCut2 = computeStageFrame(8.99, score);
    const fAtCut2 = computeStageFrame(9.0, score);
    expect(fBeforeCut2.stageCamera.shotId).toBe('shot-2');
    expect(fAtCut2.stageCamera.shotId).toBe('shot-3');
    expect(fBeforeCut2.observerCamera.shotId).toBe('obs-move-1');
    expect(fAtCut2.observerCamera.shotId).toBe('obs-move-2');

    const fBeforeCut3 = computeStageFrame(12.99, score);
    const fAtCut3 = computeStageFrame(13.0, score);
    expect(fBeforeCut3.stageCamera.shotId).toBe('shot-3');
    expect(fAtCut3.stageCamera.shotId).toBe('shot-4');
    expect(fAtCut3.stageCamera.transform.pose.focalLengthMm).toBe(85);

    const fBeforeCut4 = computeStageFrame(17.49, score);
    const fAtCut4 = computeStageFrame(17.5, score);
    expect(fBeforeCut4.stageCamera.shotId).toBe('shot-4');
    expect(fAtCut4.stageCamera.shotId).toBe('shot-5');
    expect(fAtCut4.stageCamera.maneuver).toBe('spline');

    const fBeforeCut5 = computeStageFrame(21.49, score);
    const fAtCut5 = computeStageFrame(21.5, score);
    expect(fBeforeCut5.stageCamera.shotId).toBe('shot-5');
    expect(fAtCut5.stageCamera.shotId).toBe('shot-6');
    expect(fAtCut5.stageCamera.maneuver).toBe('orbit');

    const fEnd = computeStageFrame(26.0, score);
    expect(fEnd.stageCamera.shotId).toBe('shot-6');
    expect(fEnd.observerCamera.shotId).toBe('obs-move-3');
    expect(Number.isFinite(fEnd.stageCamera.transform.position.x)).toBe(true);
    expect(Number.isFinite(fEnd.observerCamera.transform.position.x)).toBe(true);
  });

  it('validates Blueprint 03 30m ball-pass choreography, parabolic arc, Ruby orbit, straight pass and camera roll tracking', async () => {
    const bp3Item = await loadBundledScore('blueprint-03');
    expect(bp3Item).toBeDefined();
    const score = bp3Item.score;

    expect(score.durationSec).toBe(16.0);
    expect(score.shots).toHaveLength(6);
    expect(score.observerShots).toBeUndefined();

    const arthur = score.entities.find((e) => e.id === 'arthur');
    const ruby = score.entities.find((e) => e.id === 'ruby');
    const mark = score.entities.find((e) => e.id === 'mark');
    const ball = score.entities.find((e) => e.id === 'ball');

    expect(arthur).toBeDefined();
    expect(ruby).toBeDefined();
    expect(mark).toBeDefined();
    expect(ball).toBeDefined();

    expect(arthur!.position.x).toBe(-15);
    expect(ruby!.position.x).toBe(5);
    expect(mark!.position.x).toBe(15);
    expect(ruby!.position.x - arthur!.position.x).toBe(20);
    expect(mark!.position.x - ruby!.position.x).toBe(10);

    const f0 = computeStageFrame(0.0, score);
    const ballPos0 = f0.entitiesById.get('ball')!.position;
    expect(ballPos0.x).toBeCloseTo(-14.5, 2);
    expect(ballPos0.y).toBeCloseTo(1.25, 2);

    const f3 = computeStageFrame(3.0, score);
    const ballPos3 = f3.entitiesById.get('ball')!.position;
    expect(ballPos3.x).toBeCloseTo(-5.0, 2);
    expect(ballPos3.y).toBeCloseTo(5.2, 2);

    const f6 = computeStageFrame(6.0, score);
    const ballPos6 = f6.entitiesById.get('ball')!.position;
    expect(ballPos6.x).toBeCloseTo(4.6, 2);
    expect(ballPos6.y).toBeCloseTo(1.25, 2);

    const f8_5 = computeStageFrame(8.5, score);
    const ballPos8_5 = f8_5.entitiesById.get('ball')!.position;
    expect(ballPos8_5.x).toBeCloseTo(6.4, 2);
    expect(ballPos8_5.z).toBeCloseTo(0.2, 2);

    const f11 = computeStageFrame(11.0, score);
    const ballPos11 = f11.entitiesById.get('ball')!.position;
    expect(ballPos11.x).toBeCloseTo(5.6, 2);
    expect(ballPos11.y).toBeCloseTo(1.25, 2);

    const f16 = computeStageFrame(16.0, score);
    const ballPos16 = f16.entitiesById.get('ball')!.position;
    expect(ballPos16.x).toBeCloseTo(14.6, 2);
    expect(ballPos16.y).toBeCloseTo(1.25, 2);
    expect(ballPos16.z).toBeCloseTo(0.0, 2);

    for (let t = 0.5; t < 16.0; t += 2.5) {
      const ft = computeStageFrame(t, score);
      const liveBall = ft.entitiesById.get('ball')!;
      const camTarget = ft.stageCamera.transform.target;
      expect(camTarget.x).toBeCloseTo(liveBall.position.x, 2);
      expect(camTarget.z).toBeCloseTo(liveBall.position.z, 2);
    }

    expect(computeStageFrame(1.5, score).stageCamera.transform.pose.roll).toBeCloseTo(
      14 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(4.5, score).stageCamera.transform.pose.roll).toBeCloseTo(
      -18 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(7.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
      22 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(15.9, score).stageCamera.transform.pose.roll).toBeCloseTo(0, 3);

    const obsPose0 = f0.observerCamera.transform.pose;
    const obsPose16 = f16.observerCamera.transform.pose;
    expect(obsPose0.distance).toBe(38.0);
    expect(obsPose16.distance).toBe(38.0);
    expect(obsPose0.pitch).toBeCloseTo(obsPose16.pitch, 5);
    expect(obsPose0.yaw).toBeCloseTo(obsPose16.yaw, 5);
  });

  it('validates Blueprint 04 Cinematography Tutorial 20s timeline across all 16 pedagogical shots', async () => {
    const bp4Item = await loadBundledScore('blueprint-04');
    expect(bp4Item).toBeDefined();
    const score = bp4Item.score;

    expect(score.durationSec).toBe(20.0);
    expect(score.shots).toHaveLength(16);
    expect(score.observerShots).toHaveLength(1);

    const f1 = computeStageFrame(0.5, score);
    expect(f1.stageCamera.shotId).toBe('shot-01');
    expect(f1.stageCamera.transform.pose.focalLengthMm).toBe(18);
    expect(f1.stageCamera.transform.pose.distance).toBe(9.5);

    const f2 = computeStageFrame(1.8, score);
    expect(f2.stageCamera.shotId).toBe('shot-02');
    expect(f2.stageCamera.transform.pose.focalLengthMm).toBe(28);

    const f4 = computeStageFrame(4.2, score);
    expect(f4.stageCamera.shotId).toBe('shot-04');
    expect(f4.stageCamera.transform.pose.focalLengthMm).toBe(50);

    const f6 = computeStageFrame(6.8, score);
    expect(f6.stageCamera.shotId).toBe('shot-06');
    expect(f6.stageCamera.transform.pose.focalLengthMm).toBe(100);

    const f7Start = computeStageFrame(7.51, score);
    const f7End = computeStageFrame(8.74, score);
    expect(f7Start.stageCamera.shotId).toBe('shot-07');
    expect(f7Start.stageCamera.transform.pose.distance).toBeGreaterThan(3.0);
    expect(f7End.stageCamera.transform.pose.distance).toBeLessThan(2.0);

    const f9 = computeStageFrame(10.6, score);
    expect(f9.stageCamera.shotId).toBe('shot-09');
    expect(f9.stageCamera.maneuver).toBe('arc');

    const f10 = computeStageFrame(11.8, score);
    expect(f10.stageCamera.shotId).toBe('shot-10');
    expect(f10.stageCamera.maneuver).toBe('swoop');

    const f11 = computeStageFrame(13.1, score);
    expect(f11.stageCamera.shotId).toBe('shot-11');
    expect(f11.stageCamera.transform.pose.roll).toBeCloseTo(16 * (Math.PI / 180), 3);

    const f12Mid = computeStageFrame(14.375, score);
    expect(f12Mid.stageCamera.shotId).toBe('shot-12');
    expect(Math.abs(f12Mid.stageCamera.transform.pose.roll)).toBeLessThan(5 * (Math.PI / 180));

    const f13 = computeStageFrame(15.5, score);
    expect(f13.stageCamera.shotId).toBe('shot-13');
    expect(f13.stageCamera.transform.target.x).toBeCloseTo(-1.2 + 0.45, 2);
    expect(f13.stageCamera.transform.pose.roll).toBeCloseTo(0, 3);
    expect(f13.stageCamera.baseTarget!.x).toBeCloseTo(-1.2, 2);
    expect(f13.stageCamera.targetOffset!.x).toBeCloseTo(0.45, 2);

    const f14 = computeStageFrame(16.8, score);
    const heroAnchorY = 1.75 * 0.9;
    expect(f14.stageCamera.shotId).toBe('shot-14');
    expect(f14.stageCamera.transform.target.y).toBeCloseTo(heroAnchorY - 0.4, 2);
    expect(f14.stageCamera.targetOffset!.y).toBeCloseTo(-0.4, 2);

    const f15Start = computeStageFrame(17.51, score);
    const f15End = computeStageFrame(18.74, score);
    expect(f15Start.stageCamera.shotId).toBe('shot-15');
    expect(f15Start.stageCamera.transform.target.y).toBeCloseTo(heroAnchorY - 1.15, 2);
    expect(f15End.stageCamera.transform.target.y).toBeCloseTo(heroAnchorY + 0.25, 2);
    expect(f15Start.stageCamera.targetOffset!.y).toBeCloseTo(-1.15, 2);
    expect(f15End.stageCamera.targetOffset!.y).toBeCloseTo(0.25, 2);

    const f16 = computeStageFrame(19.5, score);
    expect(f16.stageCamera.shotId).toBe('shot-16');
    expect(f16.stageCamera.transform.pose.focalLengthMm).toBe(24);

    const obsStart = computeStageFrame(0.0, score).observerCamera.transform.pose;
    const obsEnd = computeStageFrame(20.0, score).observerCamera.transform.pose;
    expect(obsStart.distance).toBeCloseTo(35.93, 2);
    expect(obsStart.pitch).toBeCloseTo(24.8 * (Math.PI / 180), 3);
    expect(obsStart.yaw).toBeCloseTo(69.2 * (Math.PI / 180), 3);
    expect(obsEnd.distance).toBeCloseTo(19.63, 2);
    expect(obsEnd.pitch).toBeCloseTo(28.0 * (Math.PI / 180), 3);
    expect(obsEnd.yaw).toBeCloseTo(171.7 * (Math.PI / 180), 3);
  });

  it('evaluates Blueprint 05 (Two Rooms: Living Room to Bedroom Threshold Crossing) across all 17 shots', async () => {
    const bp05 = (await loadBundledScore('blueprint-05')).score;
    expect(bp05).toBeDefined();

    expect(bp05.durationSec).toBe(30.0);
    expect(bp05.shots).toHaveLength(17);

    const f1 = computeStageFrame(1.0, bp05);
    expect(f1.entitiesById.get('ruby')!.position.x).toBeLessThan(-4.0);
    expect(f1.entitiesById.get('samira')!.position.x).toBeLessThan(-6.0);
    expect(f1.entitiesById.get('rosa')!.position.x).toBeGreaterThan(5.0);
    expect(f1.entitiesById.get('cup')!.position.y).toBeCloseTo(0.78, 3);

    const fCross = computeStageFrame(15.0, bp05);
    expect(fCross.activeShot?.id).toBe('shot-09');
    const rubyCross = fCross.entitiesById.get('ruby')!;
    const cupCross = fCross.entitiesById.get('cup')!;
    expect(Math.abs(rubyCross.position.x)).toBeLessThan(1.0);
    expect(cupCross.position.y).toBeCloseTo(1.05, 3);
    expect(rubyCross.trailPoints).toHaveLength(17);
    expect(rubyCross.trailPoints[0].x).toBeCloseTo(-4.9, 2);
    expect(rubyCross.trailPoints[16].x).toBeCloseTo(4.3, 2);

    const fTwoShot = computeStageFrame(26.0, bp05);
    expect(fTwoShot.activeShot?.id).toBe('shot-16');
    expect(fTwoShot.entitiesById.get('ruby')!.position.x).toBeCloseTo(4.4, 2);
    expect(fTwoShot.entitiesById.get('rosa')!.position.x).toBeCloseTo(5.7, 2);
    expect(fTwoShot.entitiesById.get('cup')!.position).toEqual({ x: 5.2, y: 0.75, z: 0.5 });
    expect(fTwoShot.entitiesById.get('samira')!.position.x).toBeCloseTo(-1.4, 2);
  });

  it('evaluates Blueprint 06 (Optics, Rack Focus & DoF) across all 8 shots and optical transitions', async () => {
    const bp06 = (await loadBundledScore('blueprint-06')).score;
    expect(bp06).toBeDefined();

    expect(bp06.durationSec).toBe(36.0);
    expect(bp06.shots).toHaveLength(8);
    expect(bp06.observerShots).toHaveLength(2);

    const f1 = computeStageFrame(2.0, bp06);
    expect(f1.activeShot?.id).toBe('shot-01-off-axis-focus');
    expect(f1.stageCamera.dof.apertureFStop).toBe(2.8);
    expect(f1.stageCamera.transform.pose.focalLengthMm).toBe(50);
    expect(f1.stageCamera.dof.focusTargetPoint).toBeDefined();

    const f2Start = computeStageFrame(4.5, bp06);
    const f2End = computeStageFrame(8.99, bp06);
    expect(f2Start.activeShot?.id).toBe('shot-02-subject-rack-focus');
    expect(f2Start.stageCamera.dof.apertureFStop).toBe(2.8);
    expect(f2Start.stageCamera.transform.pose.focalLengthMm).toBe(85);
    expect(f2Start.stageCamera.dof.focusDistanceM).not.toBeCloseTo(
      f2End.stageCamera.dof.focusDistanceM,
      1
    );

    const f4 = computeStageFrame(15.0, bp06);
    expect(f4.activeShot?.id).toBe('shot-04-moving-actor-focus-track');
    expect(f4.stageCamera.dof.apertureFStop).toBe(2.0);
    expect(f4.stageCamera.dof.focusTargetPoint).toBeDefined();

    const f5Start = computeStageFrame(18.5, bp06);
    const f5End = computeStageFrame(22.99, bp06);
    expect(f5Start.activeShot?.id).toBe('shot-05-aperture-iris-ramp');
    expect(f5Start.stageCamera.dof.apertureFStop).toBeCloseTo(1.4, 1);
    expect(f5End.stageCamera.dof.apertureFStop).toBeCloseTo(11.0, 1);
    expect(f5End.stageCamera.dof.depthOfFieldM).toBeGreaterThan(
      f5Start.stageCamera.dof.depthOfFieldM * 5
    );

    const f7 = computeStageFrame(30.0, bp06);
    expect(f7.activeShot?.id).toBe('shot-07-flat-polymorphic-focus');
    expect(f7.stageCamera.dof.apertureFStop).toBe(5.6);
    expect(f7.stageCamera.dof.focusTargetPoint).toEqual({ x: 0.0, y: 1.1, z: 0.2 });

    const f8 = computeStageFrame(34.0, bp06);
    expect(f8.activeShot?.id).toBe('shot-08-deep-focus-master');
    expect(f8.stageCamera.dof.preset).toBe('deep');
    expect(f8.stageCamera.dof.depthOfFieldM).toBe(Infinity);
  });

  it('validates Blueprint 07 (Camera Rigs & Dolly Masterclass) compiles and runs cleanly across all 4 shots', async () => {
    const bp07Item = await loadBundledScore('blueprint-07');
    expect(bp07Item).toBeDefined();
    const bp07 = bp07Item.score;

    expect(bp07.durationSec).toBe(24.0);
    expect(bp07.shots).toHaveLength(4);

    const f1 = computeStageFrame(3.0, bp07);
    expect(f1.activeShot?.id).toBe('shot-01-tripod');
    expect(f1.stageCamera.rig?.type).toBe('tripod');
    expect(f1.stageCamera.transform.position.y).toBeCloseTo(1.55, 2);
    expect(f1.observerCamera.transform.pose.distance).toBeCloseTo(16.5, 2);

    const f2 = computeStageFrame(9.0, bp07);
    expect(f2.activeShot?.id).toBe('shot-02-dolly-track');
    expect(f2.stageCamera.rig?.type).toBe('track');
    expect(f2.stageCamera.rig?.railPoints.length).toBeGreaterThanOrEqual(2);
    expect(f2.stageCamera.baseTarget).toBeDefined();
    expect(f2.observerCamera.transform.pose.distance).toBeCloseTo(16.5, 2);

    const f3 = computeStageFrame(15.0, bp07);
    expect(f3.activeShot?.id).toBe('shot-03-sideways-truck');
    expect(f3.stageCamera.rig?.type).toBe('track');
    expect(f3.stageCamera.rig?.hasTargetLock).toBe(false);
    expect(f3.observerCamera.transform.pose.distance).toBeCloseTo(16.5, 2);

    const f4 = computeStageFrame(21.0, bp07);
    expect(f4.activeShot?.id).toBe('shot-04-spline-track');
    expect(f4.stageCamera.rig?.type).toBe('spline_track');
    expect(f4.stageCamera.dof.enabled).toBe(true);
    expect(f4.stageCamera.baseTarget).toBeDefined();
    expect(f4.observerCamera.transform.pose.distance).toBeCloseTo(16.5, 2);
    expect(f4.stageCamera.baseTarget!.x).toBeGreaterThan(-2.0);
    expect(f4.stageCamera.baseTarget!.x).toBeLessThan(2.5);
  });
});
