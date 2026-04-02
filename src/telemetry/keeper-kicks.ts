/**
 * Query keeper kick statistics from the telemetry database
 */

import { telemetryDb } from './db';

async function getLatestSessionId() {
  const latest = await telemetryDb.sessions.orderBy('startedAt').last();
  return latest?.id || null;
}

export async function queryKeeperKickStats(sessionId?: string) {
  const sid = sessionId || (await getLatestSessionId());
  if (!sid) return null;

  const events = await telemetryDb.telemetryEvents
    .where('sessionId')
    .equals(sid)
    .filter((e) => e.eventType === 'keeper_kick')
    .toArray();

  const byStyle: Record<string, number> = {};
  const byTeam: Record<string, number> = {};

  for (const event of events) {
    try {
      const payload = JSON.parse(event.payloadJson || '{}');
      const style = payload.style || 'UNKNOWN';
      const team = payload.team || 'UNKNOWN';
      byStyle[style] = (byStyle[style] || 0) + 1;
      byTeam[team] = (byTeam[team] || 0) + 1;
    } catch {
      // skip malformed events
    }
  }

  return {
    sessionId: sid,
    totalKicks: events.length,
    byStyle,
    byTeam,
    allEvents: events,
  };
}

export async function printKeeperKickStats(sessionId?: string) {
  const stats = await queryKeeperKickStats(sessionId);
  if (!stats) {
    console.log('No keeper kick stats found');
    return;
  }

  console.log(`\n=== Keeper Kick Statistics ===`);
  console.log(`Session: ${stats.sessionId}`);
  console.log(`Total Kicks: ${stats.totalKicks}`);
  console.log(`\nBy Style:`);
  for (const [style, count] of Object.entries(stats.byStyle)) {
    const pct = ((count / stats.totalKicks) * 100).toFixed(1);
    console.log(`  ${style}: ${count} (${pct}%)`);
  }
  console.log(`\nBy Team:`);
  for (const [team, count] of Object.entries(stats.byTeam)) {
    console.log(`  Team ${team}: ${count}`);
  }
}
