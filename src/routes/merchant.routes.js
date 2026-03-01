// src/routes/merchant.routes.js

const express = require("express");
const merchantController = require("../controllers/merchant.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/merchants", authenticate, authorize("admin"), merchantController.createMerchant);
router.get("/merchants", authenticate, authorize("admin"), merchantController.listMerchants);
router.get("/merchants/:id", authenticate, authorize("admin"), merchantController.getMerchantById);
router.patch("/merchants/:id", authenticate, authorize("admin"), merchantController.updateMerchant);
router.delete("/merchants/:id", authenticate, authorize("admin"), merchantController.deleteMerchant);

module.exports = router;
