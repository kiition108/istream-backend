import { Router } from "express";
import {
    loginUser,
    verifyOtp,
    registerUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    clearWatchHistory,
    removeFromWatchHistory,
    getLikedVideos,
    googleAuth,
    googleAuthCallback,
    forgotPassword,
    resetPassword
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import passport from '../config/passport.config.js';
const router = Router();


router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser

)
router.route("/verify-otp").post(verifyOtp);
router.route("/login").post(loginUser)
router.route("/forgot-password").post(forgotPassword)
router.route("/reset-password").post(resetPassword)
// secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/coverImage").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/c/:username").get(getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)
router.route("/history").delete(verifyJWT, clearWatchHistory)
router.route("/history/:videoId").delete(verifyJWT, removeFromWatchHistory)
router.route("/liked-videos").get(verifyJWT, getLikedVideos)

// Google OAuth routes
router.route("/auth/google").get(
    passport.authenticate('google', { scope: ['profile', 'email'] }),
    googleAuth
);

router.route("/auth/google/callback").get(
    passport.authenticate('google', {
        failureRedirect: process.env.CORS_ORIGIN ? `${process.env.CORS_ORIGIN}/auth/error` : '/auth/error',
        session: false
    }),
    googleAuthCallback
);
export default router