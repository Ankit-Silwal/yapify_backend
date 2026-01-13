import { Router } from "express";
import { createGroup,
  removeFromGroup,
  giveAdmin,
  leaveGroup,
  kickFromGroup,
  addMember
 } from "./groupSetUpManager.js";
import { checkSession } from "../../../middleware/checkSession.js";
const router=Router()
router.post('/create-group',checkSession,createGroup);
router.post('/remove-from-group',checkSession,removeFromGroup);
router.post('/give-admin',checkSession,giveAdmin);
router.post('/leave-group',checkSession,leaveGroup);
router.post('/kick-from-group',checkSession,kickFromGroup);
router.post('/addMember',checkSession,addMember);
export default router;