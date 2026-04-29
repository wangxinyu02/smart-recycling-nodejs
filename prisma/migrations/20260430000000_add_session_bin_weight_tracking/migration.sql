ALTER TABLE `recycling_sessions`
  ADD COLUMN `bin_id` INTEGER NULL,
  ADD COLUMN `start_weight` DECIMAL(8, 2) NULL,
  ADD COLUMN `final_weight` DECIMAL(8, 2) NULL;

CREATE INDEX `recycling_sessions_bin_id_idx` ON `recycling_sessions`(`bin_id`);

ALTER TABLE `recycling_sessions`
  ADD CONSTRAINT `recycling_sessions_bin_id_fkey`
  FOREIGN KEY (`bin_id`) REFERENCES `bins`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
