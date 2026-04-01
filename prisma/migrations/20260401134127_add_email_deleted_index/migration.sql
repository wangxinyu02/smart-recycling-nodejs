-- AlterTable
ALTER TABLE `users` ADD COLUMN `invited_at` DATETIME(3) NULL,
    ADD COLUMN `invited_by` INTEGER NULL,
    ADD COLUMN `must_reset_password` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `password_reset_at` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX `users_email_deleted_at_idx` ON `users`(`email`, `deleted_at`);
