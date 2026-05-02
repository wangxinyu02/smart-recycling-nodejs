// src/models/device.model.js

const prisma = require("../config/prisma");

const selectDevice = {
  id: true,
  name: true,
  type: true,
  mac_address: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
};

module.exports = {
  createDevice: (data) => {
    return prisma.device.create({
      data: {
        mac_address: data.mac_address,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
      },
      select: selectDevice,
    });
  },

  findActiveById: (id) => {
    return prisma.device.findFirst({
      where: {
        id: Number(id),
        deleted_at: null,
      },
      select: selectDevice,
    });
  },

  findActiveByMacAddress: (mac_address) => {
    return prisma.device.findFirst({
      where: {
        mac_address,
        deleted_at: null,
      },
      select: selectDevice,
    });
  },

  findActiveDuplicateByMacAddress: (mac_address, excludeId) => {
    return prisma.device.findFirst({
      where: {
        mac_address,
        deleted_at: null,
        ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
      },
      select: selectDevice,
    });
  },

  listDevices: ({ skip = 0, take = 20, q = "", available_for_bin_id }) => {
    const keyword = q?.trim();
    const filters = [
      ...(keyword
        ? [
            {
              OR: [{ name: { contains: keyword } }, { mac_address: { contains: keyword } }],
            },
          ]
        : []),
      ...(available_for_bin_id
        ? [
            {
              OR: [
                {
                  bin_maps: {
                    none: {
                      deleted_at: null,
                    },
                  },
                },
                {
                  bin_maps: {
                    some: {
                      bin_id: Number(available_for_bin_id),
                      deleted_at: null,
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ];
    const where = {
      deleted_at: null,
      ...(filters.length ? { AND: filters } : {}),
    };

    return prisma.device.findMany({
      where,
      skip,
      take,
      select: selectDevice,
      orderBy: { created_at: "desc" },
    });
  },

  countDevices: ({ q = "", available_for_bin_id }) => {
    const keyword = q?.trim();
    const filters = [
      ...(keyword
        ? [
            {
              OR: [{ name: { contains: keyword } }, { mac_address: { contains: keyword } }],
            },
          ]
        : []),
      ...(available_for_bin_id
        ? [
            {
              OR: [
                {
                  bin_maps: {
                    none: {
                      deleted_at: null,
                    },
                  },
                },
                {
                  bin_maps: {
                    some: {
                      bin_id: Number(available_for_bin_id),
                      deleted_at: null,
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ];
    const where = {
      deleted_at: null,
      ...(filters.length ? { AND: filters } : {}),
    };

    return prisma.device.count({ where });
  },

  updateDeviceById: (id, data) => {
    return prisma.device.update({
      where: { id: Number(id) },
      data,
      select: selectDevice,
    });
  },

  hasActiveBinDeviceMap: async (id) => {
    const count = await prisma.binDeviceMap.count({
      where: {
        device_id: Number(id),
        deleted_at: null,
      },
    });

    return count > 0;
  },

  findActiveDeviceByBinId: async (binId) => {
    const map = await prisma.binDeviceMap.findFirst({
      where: {
        bin_id: Number(binId),
        deleted_at: null,
        device: {
          deleted_at: null,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        device: {
          select: selectDevice,
        },
      },
    });

    return map?.device ?? null;
  },

  softDeleteDeviceById: (id) => {
    return prisma.device.update({
      where: { id: Number(id) },
      data: { deleted_at: new Date() },
      select: selectDevice,
    });
  },
};
