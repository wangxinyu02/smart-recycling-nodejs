// src/models/bin.model.js
const prisma = require("../config/prisma");

const selectBin = {
  id: true,
  name: true,
  material: true,
  location: true,
  max_weight: true,
  current_weight: true,
  status: true,
  last_seen_at: true,
  half_alert_active: true,
  full_alert_active: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  device_maps: {
    where: { deleted_at: null },
    take: 1,
    select: {
      device_id: true,
      device: {
        select: {
          id: true,
          name: true,
          mac_address: true,
        },
      },
    },
  },
};

function formatBin(bin) {
  if (!bin) return null;

  const activeDeviceMap = bin.device_maps?.[0] ?? null;
  const device = activeDeviceMap?.device ?? null;
  const { device_maps, ...rest } = bin;

  return {
    ...rest,
    device_id: activeDeviceMap?.device_id ?? null,
    device_name: device?.name ?? null,
    mac_address: device?.mac_address ?? null,
  };
}

function buildBinData(data) {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.material !== undefined ? { material: data.material } : {}),
    ...(data.location !== undefined ? { location: data.location } : {}),
    ...(data.max_weight !== undefined ? { max_weight: data.max_weight } : {}),
    ...(data.current_weight !== undefined ? { current_weight: data.current_weight } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.last_seen_at !== undefined ? { last_seen_at: data.last_seen_at } : {}),
  };
}

module.exports = {
  createBin: async (data) => {
    return prisma.$transaction(async (tx) => {
      if (data.device_id !== undefined && data.device_id !== null) {
        const existingDeviceMap = await tx.binDeviceMap.findFirst({
          where: {
            device_id: Number(data.device_id),
            deleted_at: null,
          },
          select: { id: true },
        });

        if (existingDeviceMap) {
          const err = new Error("Device is already assigned to another bin");
          err.statusCode = 409;
          throw err;
        }
      }

      const created = await tx.bin.create({
        data: {
          name: data.name ?? null,
          material: data.material,
          location: data.location ?? null,
          ...(data.max_weight !== undefined ? { max_weight: data.max_weight } : {}),
        },
        select: selectBin,
      });

      if (data.device_id !== undefined && data.device_id !== null) {
        await tx.binDeviceMap.create({
          data: {
            bin_id: created.id,
            device_id: Number(data.device_id),
          },
        });
      }

      const bin = await tx.bin.findUnique({
        where: { id: created.id },
        select: selectBin,
      });

      return formatBin(bin);
    });
  },

  getBinById: async (id) => {
    const bin = await prisma.bin.findUnique({
      where: { id: Number(id) },
      select: selectBin,
    });

    return formatBin(bin);
  },

  listBins: ({ skip = 0, take = 20, q = "", material }) => {
    const keyword = q?.trim();

    const where = {
      ...(material ? { material } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { location: { contains: keyword } },
              {
                device_maps: {
                  some: {
                    deleted_at: null,
                    device: {
                      OR: [{ name: { contains: keyword } }, { mac_address: { contains: keyword } }],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    return prisma.bin
      .findMany({
        where,
        select: selectBin,
        orderBy: { id: "asc" },
        skip,
        take,
      })
      .then((bins) => bins.map(formatBin));
  },

  countBins: ({ q = "", material }) => {
    const keyword = q?.trim();

    const where = {
      ...(material ? { material } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { location: { contains: keyword } },
              {
                device_maps: {
                  some: {
                    deleted_at: null,
                    device: {
                      OR: [{ name: { contains: keyword } }, { mac_address: { contains: keyword } }],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    return prisma.bin.count({ where });
  },

  updateBinById: (id, data) => {
    return prisma.$transaction(async (tx) => {
      const binId = Number(id);

      await tx.bin.update({
        where: { id: binId },
        data: buildBinData(data),
        select: { id: true },
      });

      if (data.device_id !== undefined) {
        const currentMap = await tx.binDeviceMap.findFirst({
          where: {
            bin_id: binId,
            deleted_at: null,
          },
          select: {
            id: true,
            device_id: true,
          },
        });

        if (data.device_id === null) {
          await tx.binDeviceMap.updateMany({
            where: {
              bin_id: binId,
              deleted_at: null,
            },
            data: { deleted_at: new Date() },
          });
        } else if (!currentMap || currentMap.device_id !== Number(data.device_id)) {
          const existingDeviceMap = await tx.binDeviceMap.findFirst({
            where: {
              device_id: Number(data.device_id),
              deleted_at: null,
              NOT: {
                bin_id: binId,
              },
            },
            select: { id: true },
          });

          if (existingDeviceMap) {
            const err = new Error("Device is already assigned to another bin");
            err.statusCode = 409;
            throw err;
          }

          await tx.binDeviceMap.updateMany({
            where: {
              bin_id: binId,
              deleted_at: null,
            },
            data: { deleted_at: new Date() },
          });

          await tx.binDeviceMap.create({
            data: {
              bin_id: binId,
              device_id: Number(data.device_id),
            },
          });
        }
      }

      const bin = await tx.bin.findUnique({
        where: { id: binId },
        select: selectBin,
      });

      return formatBin(bin);
    });
  },

  deleteBinById: (id) => {
    return prisma.bin
      .delete({
        where: { id: Number(id) },
        select: selectBin,
      })
      .then(formatBin);
  },

  findActiveDeviceById: (id) => {
    return prisma.device.findFirst({
      where: {
        id: Number(id),
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        mac_address: true,
      },
    });
  },

  listBinLogs: ({ bin_id, skip = 0, take = 50, created_at_gte }) => {
    return prisma.binLog.findMany({
      where: {
        bin_id: Number(bin_id),
        ...(created_at_gte ? { created_at: { gte: created_at_gte } } : {}),
      },
      select: {
        id: true,
        bin_id: true,
        weight: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
      skip,
      take,
    });
  },

  countBinLogs: ({ bin_id, created_at_gte }) => {
    return prisma.binLog.count({
      where: {
        bin_id: Number(bin_id),
        ...(created_at_gte ? { created_at: { gte: created_at_gte } } : {}),
      },
    });
  },

};
