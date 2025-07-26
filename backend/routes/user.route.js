import express from "express";
import { login, logout, register, updatePassword ,checkUserExistence,checkAuth } from "../controllers/user.controller.js"; // Import the updatePassword controller
import isAuthenticated from "../middlewares/isAuthenticated.js";

import {User} from "../models/user.model.js";



const router = express.Router();

router.route('/register').post(register);
router.route('/login').post(login);
router.post("/update" ,updatePassword); 
router.route('/logout').post(logout);

  

router.post("/user/check", checkUserExistence);

router.route('/checkauth').get(checkAuth);

router.get("/me", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.id).select("name username");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
