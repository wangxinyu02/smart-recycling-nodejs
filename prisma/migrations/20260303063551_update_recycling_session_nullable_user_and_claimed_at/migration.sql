-- DropForeignKey
ALTER TABLE `recycling_sessions` DROP FOREIGN KEY `recycling_sessions_user_id_fkey`;

-- AlterTable
ALTER TABLE `recycling_sessions` ADD COLUMN `claimed_at` DATETIME(3) NULL,
    MODIFY `user_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `recycling_sessions` ADD CONSTRAINT `recycling_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
