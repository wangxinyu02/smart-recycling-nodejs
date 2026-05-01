ALTER TABLE `bins`
  ADD COLUMN `half_alert_active` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `full_alert_active` BOOLEAN NOT NULL DEFAULT false;
