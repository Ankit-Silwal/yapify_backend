import { Router } from "express";
import { registerUsers, verifyUser ,loginUser,forgotPassword, verifyForgotPassword, changeForgotPassword, changePassword, resendOtp, verifyResentOtp, resendForgotPasswordOtp, verifyResentForgotPassword } from "./authManager.js";
import { checkSession } from "../../middleware/checkSession.js";
const router=Router();

router.post('/login',loginUser)
router.post('/register',registerUsers)
router.post('/verify',verifyUser);
router.post('/resend-otp',resendOtp)
router.post('/verify-resend-otp',verifyResentOtp)

router.post('/change-password',checkSession,changePassword)

router.post('/forgot-password',forgotPassword)
router.post('/verify-forgot-password',verifyForgotPassword)
router.post('/resend-forgot-password-otp',resendForgotPasswordOtp)
router.post('/verify-resend-forgot-password',verifyResentForgotPassword)
router.post('/change-forgot-password',changeForgotPassword)

export default router;

