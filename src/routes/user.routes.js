// src/routes/user.routes

const express = require("express");
const userController = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/users/", authenticate, authorize("admin"), userController.getUsers);
router.get("/users/:id", authenticate, userController.getUserById);
router.patch("/users/:id", authenticate, userController.updateUser);
router.delete("/users/:id", authenticate, userController.deleteUser);
router.get("/users/:id/home", authenticate, userController.getHome);

module.exports = router;
