import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendOTPEmail } from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken }
  }
  catch (error) {
    throw new ApiError(500, "something went wrong while generating refresh tokens")
  }
}
const registerUser = asyncHandler(async (req, res) => {

  const { fullName, email, username, password } = req.body;

  if ([fullName, email, username, password].some(field => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({ $or: [{ username }, { email }] });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath;

  if (req.files?.coverImage?.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Failed to upload avatar");
  }

  // Generate OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Send OTP
  await sendOTPEmail(email, otpCode);

  // Create User with unverified flag
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
    description: "description",
    role: "user",
    otp: {
      code: otpCode,
      expiresAt: otpExpires
    },
    isVerified: false,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user")
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
  )
})

const verifyOtp = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;
  const user = await User.findById({ _id: userId });

  if (!user || !user.otp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (
    user.otp.code !== otp ||
    user.otp.expiresAt < new Date()
  ) {
    throw new ApiError(400, "OTP is incorrect or expired");
  }

  user.isVerified = true;
  user.otp = undefined;

  await user.save();

  return res.status(200).json(new ApiResponse(200, null, "Email verified successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username or password is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credential");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None" // 7 days
  }
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser, accessToken, refreshToken
        },
        "User logged in Succcessfully"
      )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None"
  }

  return res
    .status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})
const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
      throw new ApiError(401, "unauthorised request");
    }
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id)

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "None"
    }

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200,
          { accessToken, "refreshToken": newRefreshToken },
          "Access token refreshed"
        )
      )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body
  if (newPassword != confirmPassword) {
    throw new ApiError(400, "Password is not matching please check again");
  }

  const user = await User.findById(req.user?.id)

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password")
  }

  user.password = newPassword
  user.save({ validateBeforeSave: false })

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))


})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))


})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email, username, description } = req.body

  if (!fullName && !email && !username && !description) {
    throw new ApiError(400, "All fields are required")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
        username: username,
        description: description
      }
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated succesfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      }
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "avatar image updated successfully")
    )
})
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on Cover Image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      }
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 9 } = req.query;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  // Step 1: Aggregate channel info
  const channelData = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$channel._id", "$$userId"] }
            }
          }
        ],
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$subscriber._id", "$$userId"] }
            }
          }
        ],
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        channelsSubscribedToCount: { $size: "$subscribedTo" }
      }
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        description: 1
      }
    }
  ]);

  const channel = channelData[0];
  if (!channel) {
    throw new ApiError(404, "Channel does not exist");
  }

  // Step 2: Compute isSubscribed manually using Subscription model
  // let isSubscribed = false;

  // if (req.user && req.user._id.toString() !== channel.params._id.toString()) {
  //   const subExists = await Subscription.exists({
  //     "channel._id": channel.params._id,
  //     "subscriber._id": req.user._id
  //   });
  //   isSubscribed = !!subExists;
  // }

  // Step 3: Fetch videos with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [uploadedVideos, videosCount] = await Promise.all([
    Video.find({ "owner._id": channel._id, isApproved: true, isPublished: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Video.countDocuments({ "owner._id": channel._id, isApproved: true, isPublished: true })
  ]);
  const totalPages = Math.ceil(videosCount / parseInt(limit))
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;
  return res.status(200).json(
    new ApiResponse(200, {
      ...channel,
      // isSubscribed,
      uploadedVideos,
      videosCount,
      currentPage: parseInt(page),
      totalPages,
      hasNextPage,
      hasPreviousPage
    }, "User channel fetched successfully")
  );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistoryVideos"
      }
    },
    {
      $addFields: {
        watchHistory: {
          $map: {
            input: "$watchHistory",
            as: "videoId",
            in: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$watchHistoryVideos",
                    cond: { $eq: ["$$this._id", "$$videoId"] }
                  }
                },
                0
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        watchHistory: 1
      }
    }
  ])

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0]?.watchHistory || [],
        "watch history fetched successfully"
      )
    )
})

// Clear all watch history
const clearWatchHistory = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { watchHistory: [] } }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "Watch history cleared successfully")
    );
});

// Remove specific video from watch history
const removeFromWatchHistory = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { watchHistory: videoId } }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "Video removed from watch history")
    );
});

// Get all liked videos
const getLikedVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get liked video IDs with pagination
  const likedVideos = await Like.find({ user: req.user._id, type: 'like' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('video');

  // Count total liked videos
  const total = await Like.countDocuments({ user: req.user._id, type: 'like' });
  const totalPages = Math.ceil(total / parseInt(limit));

  // Extract video objects
  const videos = likedVideos.map(like => like.video).filter(v => v !== null);

  return res
    .status(200)
    .json(
      new ApiResponse(200, {
        videos,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalVideos: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }, "Liked videos fetched successfully")
    );
});

// Google OAuth Controllers
const googleAuth = asyncHandler(async (req, res) => {
  // This will be handled by passport middleware
  // The actual redirect to Google is done in the route
});

const googleAuthCallback = asyncHandler(async (req, res) => {
  try {
    // User is attached by passport after successful authentication
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "Google authentication failed");
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "None"
    };

    // Redirect to frontend with tokens
    const frontendURL = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const redirectURL = `${frontendURL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .redirect(redirectURL);
  } catch (error) {
    const frontendURL = process.env.CORS_ORIGIN || 'http://localhost:3000';
    return res.redirect(`${frontendURL}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
});

export {
  registerUser,
  loginUser,
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
  verifyOtp,
  googleAuth,
  googleAuthCallback,
}