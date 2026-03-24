import { authenticate } from "../middleware/auth.middleware";
import authControllers from "../controllers/authControllers";
import { Router } from "express";

const router = Router();

router.post("/register", authControllers.register);
router.post("/login", authControllers.login);
router.post("/profile", authenticate, authControllers.getProfile);

export default router;
