ALTER TABLE `bins`
  ADD COLUMN `max_weight` DECIMAL(8, 2) NULL,
  ADD COLUMN `current_weight` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'unknown',
  ADD COLUMN `last_seen_at` DATETIME(3) NULL;

CREATE TABLE `bin_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `bin_id` INTEGER NOT NULL,
  `weight` DECIMAL(8, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `bin_logs_bin_id_idx`(`bin_id`),
  INDEX `bin_logs_created_at_idx`(`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bin_logs`
  ADD CONSTRAINT `bin_logs_bin_id_fkey`
  FOREIGN KEY (`bin_id`) REFERENCES `bins`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
