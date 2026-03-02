// src/models/bin.model.js
const prisma = require("../config/prisma");

const selectBin = {
  id: true,
  name: true,
  material: true,
};

module.exports = {
  createBin: (data) => {
    return prisma.bin.create({
      data: {
        name: data.name ?? null,
        material: data.material,
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
      },
      select: selectBin,
    });
  },

};