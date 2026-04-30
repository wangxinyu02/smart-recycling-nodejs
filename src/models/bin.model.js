// src/models/bin.model.js
const prisma = require("../config/prisma");

const selectBin = {
  id: true,
  name: true,
  material: true,
  max_weight: true,
  current_weight: true,
  status: true,
  last_seen_at: true,
};

module.exports = {
  createBin: (data) => {
    return prisma.bin.create({
      data: {
        name: data.name ?? null,
        material: data.material,
        ...(data.max_weight !== undefined ? { max_weight: data.max_weight } : {}),
      },
      select: selectBin,
    });
  },

  getBinById: (id) => {
    return prisma.bin.findUnique({
      where: { id: Number(id) },
      select: selectBin,
    });
  },

  listBins: ({ skip = 0, take = 20, q = "", material }) => {
    const keyword = q?.trim();

    const where = {
      ...(material ? { material } : {}),
      ...(keyword
        ? {
            OR: [{ name: { contains: keyword } }],
          }
        : {}),
    };

    return prisma.bin.findMany({
      where,
      select: selectBin,
      orderBy: { id: "desc" },
      skip,
      take,
    });
  },

  countBins: ({ q = "", material }) => {
    const keyword = q?.trim();

    const where = {
      ...(material ? { material } : {}),
      ...(keyword
        ? {
            OR: [{ name: { contains: keyword } }],
          }
        : {}),
    };

    return prisma.bin.count({ where });
  },

  updateBinById: (id, data) => {
    return prisma.bin.update({
      where: { id: Number(id) },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.material !== undefined ? { material: data.material } : {}),
        ...(data.max_weight !== undefined ? { max_weight: data.max_weight } : {}),
        ...(data.current_weight !== undefined ? { current_weight: data.current_weight } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.last_seen_at !== undefined ? { last_seen_at: data.last_seen_at } : {}),
      },
      select: selectBin,
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
