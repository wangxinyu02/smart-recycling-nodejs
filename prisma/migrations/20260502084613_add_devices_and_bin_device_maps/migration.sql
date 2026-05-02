-- AlterTable
ALTER TABLE `bins` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `location` VARCHAR(150) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NULL,
    `type` ENUM('esp32', 'other') NOT NULL DEFAULT 'esp32',
    `mac_address` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `devices_mac_address_key`(`mac_address`),
    INDEX `devices_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bin_device_maps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bin_id` INTEGER NOT NULL,
    `device_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `bin_device_maps_bin_id_idx`(`bin_id`),
    INDEX `bin_device_maps_device_id_idx`(`device_id`),
    INDEX `bin_device_maps_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `bins_deleted_at_idx` ON `bins`(`deleted_at`);

-- CreateIndex
CREATE INDEX `bins_status_idx` ON `bins`(`status`);

-- CreateIndex
CREATE INDEX `bins_material_idx` ON `bins`(`material`);

-- AddForeignKey
ALTER TABLE `bin_device_maps` ADD CONSTRAINT `bin_device_maps_bin_id_fkey` FOREIGN KEY (`bin_id`) REFERENCES `bins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bin_device_maps` ADD CONSTRAINT `bin_device_maps_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
