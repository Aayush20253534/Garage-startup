-- Garage controllers are phone-first accounts. Email is optional and remains
-- unique whenever it is supplied; PostgreSQL permits multiple NULL values in
-- a unique index.
ALTER TABLE "garage_controllers"
  ALTER COLUMN "email" DROP NOT NULL;
