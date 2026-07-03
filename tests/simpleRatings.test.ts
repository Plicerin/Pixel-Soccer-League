import assert from "node:assert/strict";
import test from "node:test";
import {
  getSofifaNationalTeamProfile,
  getTeamStrengthProfile,
  getTeamTuning,
} from "../src/core/simpleRatings";
import { FIFA_MEN_RANKINGS_2026_04_01 } from "../src/data/fifaMenRankings2026-04-01";
import {
  SOFIFA_NATIONAL_TEAMS,
  SOFIFA_NATIONAL_TEAMS_STATUS,
} from "../src/data/sofifaNationalTeams";

test("FIFA men ranking snapshot covers all 48 playable 2026 national teams", () => {
  assert.equal(FIFA_MEN_RANKINGS_2026_04_01.length, 48);
  assert.equal(new Set(FIFA_MEN_RANKINGS_2026_04_01.map((row) => row.team)).size, 48);
});

test("Germany carries a stronger dormant FIFA profile than Algeria", () => {
  const germany = getTeamStrengthProfile("Germany");
  const algeria = getTeamStrengthProfile("Algeria");

  assert.equal(germany.source, "fifa-men-2026-04-01");
  assert.equal(algeria.source, "fifa-men-2026-04-01");
  assert.equal(germany.rank, 10);
  assert.equal(algeria.rank, 28);
  assert.ok((germany.normalizedStrength ?? 0) > (algeria.normalizedStrength ?? 0));
});

test("FIFA strength layer now affects national-team gameplay tuning", () => {
  const germany = getTeamTuning("Germany");
  const algeria = getTeamTuning("Algeria");

  assert.ok((germany.attack ?? 0) > (algeria.attack ?? 0));
  assert.ok((germany.defense ?? 0) > (algeria.defense ?? 0));
  assert.ok((germany.tempo ?? 0) > (algeria.tempo ?? 0));
  assert.ok((germany.possession ?? 0) > (algeria.possession ?? 0));
  assert.equal(germany.strengthProfile?.active, true);
  assert.equal(algeria.strengthProfile?.active, true);
  assert.equal(germany.strengthProfile?.effectScale, 1);
});

test("SOFIFA national-team scaffold covers all 48 playable teams without inventing values", () => {
  assert.equal(SOFIFA_NATIONAL_TEAMS.length, 48);
  assert.equal(new Set(SOFIFA_NATIONAL_TEAMS.map((row) => row.team)).size, 48);
  assert.ok(SOFIFA_NATIONAL_TEAMS.every((row) => row.overall === null && row.attack === null && row.midfield === null && row.defense === null));
  assert.equal(SOFIFA_NATIONAL_TEAMS_STATUS, "pending");
});

test("Dormant SOFIFA layer is present but inactive until real ratings are imported", () => {
  const germany = getSofifaNationalTeamProfile("Germany");
  const algeria = getSofifaNationalTeamProfile("Algeria");
  const tuning = getTeamTuning("Germany");

  assert.equal(germany.source, "pending");
  assert.equal(algeria.source, "pending");
  assert.equal(germany.active, false);
  assert.equal(germany.effectScale, 0);
  assert.equal(germany.overall, null);
  assert.equal(tuning.sofifaProfile?.source, "pending");
});
