import { Router } from "express";
import { checkSession } from "../../middleware/checkSession.js";
import { searchUsers, findUserByUsername } from "./userManager.js";

const router = Router();

router.get('/search', checkSession, searchUsers);
router.get('/find-user', checkSession, findUserByUsername);

export default router;
