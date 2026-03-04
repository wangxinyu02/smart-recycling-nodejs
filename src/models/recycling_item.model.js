// src/models/recycling_item.model.js

const prisma = require("../config/prisma");

const selectItem = {
  id: true,
  session_id: true,
  bin_id: true,
  material: true,
  weight: true,
  co2_saved: true,
  created_at: true,
};

const to2dpString = (n) => Number(n).toFixed(2);

module.exports = {
  getById: (id) => {
    return prisma.recyclingItem.findUnique({
      where: { id: Number(id) },
      select: selectItem,
    });
  },

  listBySessionId: ({ session_id, skip = 0, take = 50 }) => {
    return prisma.recyclingItem.findMany({
      where: { session_id: Number(session_id) },
      select: selectItem,
      orderBy: { created_at: "desc" },
      skip,
      take,
    });
  },

  countBySessionId: ({ session_id }) => {
    return prisma.recyclingItem.count({
      where: { session_id: Number(session_id) },
    });
  },

  // Create item + increment session.total_co2
  createItemAndUpdateSessionTotal: async (data) => {
    const sessionId = Number(data.session_id);
    const co2 = Number(data.co2_saved);

    return prisma.$transaction(async (tx) => {
      const item = await tx.recyclingItem.create({
        data: {
          session_id: sessionId,
          bin_id: Number(data.bin_id),
          material: data.material,
          weight: to2dpString(data.weight),
          co2_saved: to2dpString(co2),
        },
        select: selectItem,
      });

      await tx.recyclingSession.update({
        where: { id: sessionId },
        data: {
          total_co2: {
            increment: to2dpString(co2),
          },
        },
      });

      return item;
    });
  },
};
