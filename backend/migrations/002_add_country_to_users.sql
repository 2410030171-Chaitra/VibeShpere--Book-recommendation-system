-- Migration: add country to users
ALTER TABLE users ADD COLUMN country VARCHAR(64) NULL AFTER time_budget_hours;