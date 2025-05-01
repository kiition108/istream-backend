import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary,deleteFromCloudinary } from "../utils/cloudinary.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from 'path'


// Define local paths to ffmpeg and ffprobe
const ffmpegPath = path.resolve('ffmpeg/bin/ffmpeg')
const ffprobePath = path.resolve('ffmpeg/bin/ffprobe')

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

// Utility to extract duration using FFmpeg
const getVideoDuration = (videoRelativePath) => {
    const absolutePath = path.resolve(videoRelativePath)
    if (!fs.existsSync(absolutePath)) {
        throw new Error("Uploaded video file not found before probing")
    }
    else{
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(absolutePath, (err, metadata) => {
      if (err){
        console.error("FFprobe error:", err)
         return reject(err);
      }
      const durationInSec = metadata.format.duration;
      const formatted = new Date(durationInSec * 1000).toISOString().substr(11, 8);
      resolve(formatted);
    });
  });
}
};

// Upload a new video
export const uploadVideo = asyncHandler(async (req, res) => {
  const { title, description, isPublished = true } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "Title and description are required.");
  }

  if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
    throw new ApiError(400, "Both video and thumbnail files are required.");
  }

  const videoPath = req.files.videoFile[0].path;
  const thumbnailPath = req.files.thumbnail[0].path;
  // Extract duration from video using FFmpeg
  const duration = await getVideoDuration(videoPath);
  // Upload to Cloudinary
  const videoUpload = await uploadOnCloudinary(videoPath, "video");
  const thumbnailUpload = await uploadOnCloudinary(thumbnailPath, "image");

 

  // Cleanup temp files
//   fs.unlinkSync(videoPath);
//   fs.unlinkSync(thumbnailPath);

  const newVideo = await Video.create({
    videoFile: videoUpload.secure_url,
    thumbnail: thumbnailUpload.secure_url,
    title,
    description,
    duration,
    isPublished,
    owner: req.user._id,
    videoPublicId: videoUpload.public_id,
    thumbnailPublicId: thumbnailUpload.public_id,
    isApproved: false, // Admin toggles this
  });

  return res.status(201).json(new ApiResponse(201, newVideo, "Video uploaded successfully"));
});

// List videos with pagination
export const listVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const user = req.user; // assuming you're using middleware to attach the authenticated user
    
    const matchConditions = {
      isPublished: true, // Only show published videos
    };
  
    // Only non-admins should be restricted to approved videos
    if (user.role !== 'admin') {
      matchConditions.isApproved = true;
    }
  
    const aggregate = Video.aggregate([
      { $match: matchConditions },
      { $sort: { createdAt: -1 } }
    ]);
  
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
    };
  
    const result = await Video.aggregatePaginate(aggregate, options);
  
    return res.status(200).json(new ApiResponse(200, result, "Videos fetched"));
  });
  

export const getUserVideos = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const videos = await Video.find({ owner: userId })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: videos,
    message: "User videos fetched successfully"
  });
});


// Get a single video by ID
export const getVideoById = asyncHandler(async (req, res) => {
    const { id } = req.params;
  
    const video = await Video.findOne({ 
      _id: id, 
      isPublished: true,
      isApproved: true 
    }).populate('owner','username');
  
    if (!video) {
      throw new ApiError(404, "Video not found");
    }
  
    return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
  });
  
// Toggle video approval (Admin only)
export const toggleApproval = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  video.isApproved = !video.isApproved;
  await video.save();

  return res.status(200).json(new ApiResponse(200, video, `Video ${video.isApproved ? "approved" : "unapproved"}`));
});

// Toggle privacy
export const togglePrivacy = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findOne({ _id: videoId, owner: req.user._id });
  if (!video) throw new ApiError(404, "Video not found or unauthorized");

  video.isPublished = !video.isPublished;
  await video.save();

  return res.status(200).json(new ApiResponse(200, video, `Video is now ${video.isPublished ? "public" : "private"}`));
});

//delete video from cloudinary and mongo
export const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
  
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");
  
    if (video.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Unauthorized to delete this video");
    }
    //delete from cloudinary
    try {
      if (video.videoPublicId) {
        await deleteFromCloudinary(video.videoPublicId, 'video')
      }
      if (video.thumbnailPublicId) {
        await deleteFromCloudinary(video.thumbnailPublicId, 'image');
      }
    } catch (err) {
      console.error("Error deleting from Cloudinary:", err);
      throw new ApiError(500, "Cloudinary deletion failed");
    }
    //delete from mongo db
    await video.deleteOne();
  
    return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
  });
  

  // PUT /video/:id
  
  
  export const updateVideo = asyncHandler(async (req, res) => {
    const { title, description, isPublished } = req.body;
    const videoId = req.params.id;
    const userId = req.user._id;
  
    const video = await Video.findById(videoId);
  
    if (!video) {
      throw new ApiError(404, 'Video not found');
    }
  
    if (video.owner.toString() !== userId.toString()) {
      throw new ApiError(403, 'Not authorized to edit this video');
    }
  
    // Update basic fields
    video.title = title || video.title;
    video.description = description || video.description;
    video.isPublished = isPublished !== undefined ? isPublished : video.isPublished;
  
    // Handle thumbnail update if provided
    if (req.file) {
      // Delete old thumbnail if exists
      if (video.thumbnailPublicId) {
        await deleteFromCloudinary(video.thumbnailPublicId, 'image');
      }
  
      // Upload new thumbnail
      const thumbnailUpload = await uploadOnCloudinary(req.file.path, 'image');
  
      video.thumbnail = thumbnailUpload.secure_url;
      video.thumbnailPublicId = thumbnailUpload.public_id;
    }
  
    await video.save();
  
    res.status(200).json(new ApiResponse(200, video, 'Video updated successfully'));
  });
  
  
