import { Router } from 'express';
import { telemetryDb } from '../telemetry/db';

const router = Router();

router.get('/api/stats/keeper-kicks', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    
    // Get latest session if not specified
    let sid = sessionId;
    if (!sid) {
      const latest = await telemetryDb.sessions.orderBy('startedAt').last();
      sid = latest?.id;
    }
    
    if (!sid) {
      return res.json({ error: 'No sessions found', data: null });
    }
    
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
    
    res.json({
      sessionId: sid,
      totalKicks: events.length,
      byStyle,
      byTeam,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
