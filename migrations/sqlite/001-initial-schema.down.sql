-- migrations/sqlite/001-initial-schema.down.sql
-- Reverse of 001-initial-schema.sql. Drop in reverse dependency order.
DROP TABLE IF EXISTS phase2_feature_flag_eval;
DROP TABLE IF EXISTS phase2_release;