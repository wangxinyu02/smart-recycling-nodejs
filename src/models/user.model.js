const prisma = require("../config/prisma");

module.exports = {
  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),

  createUser: (data) =>
    prisma.user.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        password_hash: true,
      },
    }),
};
