import { Router } from "express";
import { registerUsers } from "./authManager.js";
import { loginUser } from "./authManager.js";
const router=Router();

router.post('/login',loginUser)
router.post('/register',registerUsers)

export default router;

