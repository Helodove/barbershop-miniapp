-- Fix bonus_cap constraint: total_price is now stored as ORIGINAL price (before deduction)
-- So the constraint bonus_used <= total_price * 0.20 is correct
-- But we need to drop and recreate to be safe

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_bonus_cap;

ALTER TABLE appointments ADD CONSTRAINT appointments_bonus_cap
  CHECK (bonus_used <= FLOOR(total_price * 0.20));
