import { Router } from "express";
import { registerUsers, verifyUser } from "./authManager.js";
import { loginUser } from "./authManager.js";
const router=Router();

router.post('/login',loginUser)
router.post('/register',registerUsers)
router.post('/verify',verifyUser);

export default router;

