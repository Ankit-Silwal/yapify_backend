import { Router } from "express";
import { registerUsers, verifyUser ,loginUser,forgotPassword, verifyForgotPassword} from "./authManager.js";
import { checkSession } from "../../middleware/checkSession.js";
const router=Router();

router.post('/login',loginUser)
router.post('/register',registerUsers)
router.post('/verify',verifyUser);
router.post('/forgot-password',forgotPassword)
router.post('/verify-forgot-password',verifyForgotPassword)

export default router;

