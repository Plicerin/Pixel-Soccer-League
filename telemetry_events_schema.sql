-- Telemetry Events Table
CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    session_id TEXT NOT NULL,
    player_id TEXT,
    payload TEXT
);
