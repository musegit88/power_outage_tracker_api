import { authenticate } from "../middleware/auth.middleware";
import outageController from "../controllers/outageController";
import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import {
  createOutageSchema,
  inMapBoundsSchema,
  nearbyOutagesSchema,
  outageIdSchema,
  updateStatusSchema,
} from "../validation/schemas";

const router = Router();

// Public routes
router.get("/", outageController.getAllOutages);
router.get(
  "/nearby",
  validate(nearbyOutagesSchema),
  outageController.getNearByOutages,
);
router.get(
  "/in-bounds",
  validate(inMapBoundsSchema),
  outageController.getInMapBounds,
);
router.get("/statistics", outageController.getStatistics);
router.get("/:id", validate(outageIdSchema), outageController.getOutageById);

// protected routes
router.post(
  "/create",
  authenticate,
  validate(createOutageSchema),
  outageController.createOutage,
);
router.patch(
  "/:id/status",
  validate(updateStatusSchema),
  authenticate,
  outageController.updateStatus,
);
router.post("/:id/confirm", authenticate, outageController.addConfirmation);
router.delete("/:id", authenticate, outageController.deleteOutage);
router.get(
  "/rate-limit/:userId",
  authenticate,
  outageController.getRateLimitStatus,
);

export default router;
