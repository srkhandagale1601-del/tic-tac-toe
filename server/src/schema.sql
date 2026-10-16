CREATE TABLE IF NOT EXISTS matches (
 id BIGSERIAL PRIMARY KEY,
 room_code VARCHAR(12) NOT NULL,
 mode VARCHAR(8) NOT NULL CHECK (mode IN ('pvp','ai')),
 player_x VARCHAR(80) NOT NULL,
 player_o VARCHAR(80) NOT NULL,
 winner VARCHAR(8) CHECK (winner IN ('X','O','draw')),
 final_board JSONB NOT NULL,
 finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS matches_finished_at_idx ON matches(finished_at DESC);
