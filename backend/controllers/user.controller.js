import {User} from "../models/user.model.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";




export const checkAuth = async (req, res) => {
  try {
    const token = req.cookies.token; 
    if (!token) {
      return res.json({ isAuthenticated: false });
    }

    jwt.verify(token, process.env.SECRET_KEY); 
    return res.json({ isAuthenticated: true });
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.json({ isAuthenticated: false });
  }
};

  

 
export const checkUserExistence = async (req, res) => {
    const { username, email } = req.body;

    try {
        // Check if either the username or email exists
        const user = await User.findOne({ $or: [{ email }, { username }] });

        if (user) {
            // If user exists, return true
            return res.json({ exists: true });
        }

        // If no user found, return false
        return res.json({ exists: false });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
};

export const register = async (req, res) => {
    try {
        const {Name, username, email, password ,university} = req.body;
        if (!username || !email || !password) {
            return res.status(401).json({
                message: "Something is missing, please check!",
                success: false,
            });
        }

        // Check if the username already exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(401).json({
                message: "Username is already taken, try a different one.",
                success: false,
            });
        }

        // Check if the email already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(401).json({
                message: "Email is already registered, try a different one.",
                success: false,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            Name,
            username,
            email,
            password: hashedPassword,
            university
        });

        return res.status(201).json({
            message: "Account created successfully.",
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "An error occurred while creating the account.",
            success: false,
        });
    }
};


export const login = async (req, res) => {
    try {
      const { username, password } = req.body;
      const { rememberMe } = req.query;  // Get the rememberMe status from query parameters
  
      if (!username || !password) {
        return res.status(401).json({
          message: "Something is missing, please check!",
          success: false
        });
      }
  
      let user = await User.findOne({ username });
      if (!user) {
        return res.status(401).json({
          message: "Incorrect username or password",
          success: false
        });
      }
  
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).json({
          message: "Incorrect username or password",
          success: false
        });
      }
  
    
      const token = await jwt.sign(
        { userId: user._id },
        process.env.SECRET_KEY,
        { expiresIn: rememberMe === 'true' ? '14d' : '2h' }  
      );
  
      return res.cookie('token', token, {
        httpOnly: true, 
        sameSite: 'strict', 
        maxAge: rememberMe === 'true' ? 14 * 24 * 60 * 60 * 1000 :  6*60 * 60 * 1000 
      }).json({
        message: `Welcome back ${user.username}`,
        success: true,
        user
      });
  
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };


export const updatePassword = async (req, res) => {
    try {
      const { password, confirmPassword, email } = req.body;
  
      // Ensure password and confirmPassword are provided
      if (!password || !confirmPassword) {
        return res.status(400).json({
          message: "Both password and confirm password are required.",
          success: false,
        });
      }
  
      // Ensure the passwords match
      if (password !== confirmPassword) {
        return res.status(400).json({
          message: "Passwords do not match.",
          success: false,
        });
      }
  
      // Find the user by email
      const user = await User.findOne({ email });
  
      if (!user) {
        return res.status(404).json({
          message: "User not found.",
          success: false,
        });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Update the user's password
      user.password = hashedPassword;
      await user.save();
  
      return res.status(200).json({
        message: "Password updated successfully.",
        success: true,
      });
    } catch (error) {
      console.error("Error updating password:", error);
      return res.status(500).json({
        message: "Error updating password. Please try again.",
        success: false,
      });
    }
  };

export const logout=async (req,res) => {
    try {
        return res.cookie("token", "", {maxAge:0}).json({
            message: 'Logged out successfully.'
        });
    } catch (error) {
        console.log(error);
    }
};





