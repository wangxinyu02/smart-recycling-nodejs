-- Drop the global unique constraint so soft-deleted device MAC addresses can be reused.
DROP INDEX `devices_mac_address_key` ON `devices`;

-- Keep active-device lookup efficient for application-level duplicate checks.
CREATE INDEX `devices_mac_address_deleted_at_idx` ON `devices`(`mac_address`, `deleted_at`);
