-- CreateIndex
CREATE INDEX `users_invited_by_idx` ON `users`(`invited_by`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_invited_by_fkey` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
