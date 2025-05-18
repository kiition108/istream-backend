import { ApiError } from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendOTPEmail } from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";

const generateAccessAndRefreshTokens= async(userId)=>{
        try{
             const user=await User.findById(userId);
             const accessToken=user.generateAccessToken();
             const refreshToken=user.generateRefreshToken();
             user.refreshToken= refreshToken;
             await user.save({validateBeforeSave: false});
             return {accessToken, refreshToken}
        }
        catch(error){
            throw new ApiError(500,"something went wrong while generating refresh tokens")
        }
}
const registerUser= asyncHandler( async(req,res)=>{
    
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
    role: "user",
    otp: {
      code: otpCode,
      expiresAt: otpExpires
    },
    isVerified: false,
  });

    const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
          throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser,"User registered Successfully")
    )
})

const verifyOtp = asyncHandler(async (req, res) => {
    const { userId, otp } = req.body;
    const user = await User.findById({_id:userId});
  
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
  
const loginUser= asyncHandler( async(req,res)=>{
       const {email, username, password}=  req.body;
       if(!(username || email)){
          throw new ApiError(400, "username or password is required");
       }
       const user=await User.findOne({
        $or: [{username},{email}]
       })

       if(!user){
           throw new ApiError(404, "User does not exist");
       }

       const isPasswordValid= await user.isPasswordCorrect(password)

       if(!isPasswordValid){
         throw new ApiError(401,"Invalid credential");
       }
       const { accessToken, refreshToken}=await generateAccessAndRefreshTokens(user._id);
       
       const loggedInUser= await User.findById(user._id)
       .select("-password -refreshToken")

       const options={ 
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

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options={
        httpOnly:true,
        secure:true,
        sameSite: "None"
    }

    return res
    .status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})
const refreshAccessToken = asyncHandler( async(req, res)=>{
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
        if(!incomingRefreshToken){
            throw new ApiError(401,"unauthorised request");
        }
        const decodedToken= jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
        const user=await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token");
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options={
            httpOnly: true,
            secure: true,
            sameSite: "None"
        }
    
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {accessToken, "refreshToken": newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message|| "Invalid refresh token")
    }
})

const changeCurrentPassword= asyncHandler( async(req,res)=>{
    const {oldPassword, newPassword, confirmPassword}= req.body
    if(newPassword!=confirmPassword){
          throw new ApiError(400,"Password is not matching please check again");
    }

    const user= await User.findById(req.user?.id)

    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password=newPassword
    user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))


})

const getCurrentUser = asyncHandler( async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))

    
})

const updateAccountDetails= asyncHandler( async(req,res)=>{
    const {fullName, email, username}= req.body

    if(!fullName&&!email&&!username){
        throw new ApiError(400, "All fields are required")
    }
    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email: email,
                username: username
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user,"Account details updated succesfully"))
})

const updateUserAvatar= asyncHandler( async(req,res)=>{
    const avatarLocalPath=req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url,
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar image updated successfully")
    )
})
const updateUserCoverImage= asyncHandler( async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on Cover Image")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url,
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    const { page = 1, limit = 10 } = req.query;
  
    if (!username?.trim()) {
      throw new ApiError(400, "Username is missing");
    }
  
    const channelData = await User.aggregate([
      {
        $match: {
          username: username.toLowerCase()
        }
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers"
        }
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo"
        }
      },
      {
        $addFields: {
          subscribersCount: { $size: "$subscribers" },
          channelsSubscribedToCount: { $size: "$subscribedTo" },
          isSubscribed: {
            $cond: {
              if: { $in: [req.user?._id, "$subscribers.subscriber"] },
              then: true,
              else: false
            }
          }
        }
      },
      {
        $project: {
          fullName: 1,
          username: 1,
          subscribersCount: 1,
          channelsSubscribedToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1,
          email: 1
        }
      }
    ]);
  
    const channel = channelData[0];
    if (!channel) {
      throw new ApiError(404, "Channel does not exist");
    }
  
    // Fetch videos separately with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [uploadedVideos, videosCount] = await Promise.all([
      Video.find({ owner: channel._id, isApproved: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Video.countDocuments({ owner: channel._id, isApproved: true })
    ]);
  
    return res.status(200).json(
      new ApiResponse(200, {
        ...channel,
        uploadedVideos,
        videosCount,
        currentPage: parseInt(page),
        totalPages: Math.ceil(videosCount / parseInt(limit))
      }, "User channel fetched successfully")
    );
  });
  

const getWatchHistory= asyncHandler(async(req,res)=>{
      const user= await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
      ])

      return res
      .status(200)
      .json(
           new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history fetched successfully"
           )
      )
})
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
    verifyOtp,
}