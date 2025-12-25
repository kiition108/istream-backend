import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe'; // Optional: only if needed separately
import fs from "fs";
import path from 'path'


// Define local paths to ffmpeg and ffprobe


ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path); // optional if ffprobe is needed


// Utility to extract duration using FFmpeg
const getVideoDuration = (videoRelativePath) => {
  const absolutePath = path.resolve(videoRelativePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error("Uploaded video file not found before probing")
  }
  else {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(absolutePath, (err, metadata) => {
        if (err) {
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
//list videos for all users either guest or logged in
export const approvedListedVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 9 } = req.query;

  const videos = Video.aggregate([{
    $match: {
      isApproved: true,
      isPublished: true
    }
  }])

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await Video.aggregatePaginate(videos, options);

  return res.status(200).json(new ApiResponse(200, result, "Videos fetched"));
});

// List videos with pagination
export const listVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 9 } = req.query;
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
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'owner._id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $unwind: '$userInfo'
    },
    {
      $project: {
        title: 1,
        description: 1,
        thumbnail: 1,
        isApproved: 1,
        createdAt: 1,
        'userInfo.role': 1,
        'userInfo.username': 1,
        'userInfo.avatar': 1
      }
    }
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await Video.aggregatePaginate(aggregate, options);

  return res.status(200).json(new ApiResponse(200, result, "Videos fetched"));
});


export const getUserVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 9 } = req.query;
  const user = req.user;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 }
  };

  const aggregate = Video.aggregate([
    {
      $match: {
        "owner._id": user._id  // Ensure owner is stored as ObjectId
      }
    },
    {
      $sort: { createdAt: -1 }
    }
  ]);

  const result = await Video.aggregatePaginate(aggregate, options);

  res.status(200).json({
    success: true,
    data: result,
    message: "User videos fetched successfully"
  });
});

export const getVideoForAdminAndOwnerById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const video = await Video.findOne({
    _id: id,
  }).populate('owner', 'username');
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if ((user?.role !== 'admin') && !(video?.owner?._id.equals(user?._id))) {
    throw new ApiError(401, "you are not authorised to watch this video");
  }


  return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
})
// Get a single video by ID
export const getVideoById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const video = await Video.findOne({
    _id: id,
    isPublished: true,
    isApproved: true
  }).populate('owner', 'username');

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

  const video = await Video.findOne({ _id: videoId, "owner._id": req.user._id });
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

  if (video.owner._id.toString() !== req.user._id.toString()) {
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

  if (video.owner._id.toString() !== userId.toString()) {
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
export const addComment = asyncHandler(async (req, res) => {
  try {
    const user = req.user
    const videoId = req.params.videoId;
    const { text } = req.body;
    if (!user) return res.status(404).json(new ApiError(404, 'User not found'));

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json(new ApiError(404, 'Video not found'));

    const comment = {
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
      },
      text,
    };

    video.comments.unshift(comment);
    await video.save();

    res.status(201).json(new ApiResponse(201, comment, 'new comment posted'));
  } catch (err) {
    res.status(500).json(new ApiError(500, 'Failed to add comment'));
  }
});

export const getComment = asyncHandler(async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const video = await Video.findById(videoId).select('comments');
    if (!video) return res.status(404).json(new ApiError(404, 'Video not found'));
    res.json(new ApiResponse(200, video.comments, 'comment fetched succesfully'));
  } catch (err) {
    res.status(500).json(new ApiError(500, 'Failed to get comments'));
  }
});

// Record a video view and add to watch history
export const recordView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  let isFirstView = true;

  // Check if user is authenticated
  if (req.user) {
    // Check if user has already watched this video
    const user = await User.findById(req.user._id);
    const hasWatched = user.watchHistory.some(
      (id) => id.toString() === videoId
    );

    isFirstView = !hasWatched;

    // Update watch history atomically - remove duplicates and add to beginning
    await User.findByIdAndUpdate(
      req.user._id,
      [
        {
          $set: {
            watchHistory: {
              $concatArrays: [
                [{ $toObjectId: videoId }],
                {
                  $filter: {
                    input: "$watchHistory",
                    cond: { $ne: ["$$this", { $toObjectId: videoId }] }
                  }
                }
              ]
            }
          }
        }
      ]
    );
  }

  // Only increment view count if it's first view by this user (or guest user)
  if (isFirstView) {
    video.views += 1;
    await video.save();
  }

  return res.status(200).json(
    new ApiResponse(200, {
      views: video.views,
      isFirstView
    }, "View recorded successfully")
  );
});

// Toggle like on a video
export const toggleLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  // Check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check existing reaction
  const existingReaction = await Like.findOne({ user: userId, video: videoId });

  if (!existingReaction) {
    // No reaction yet - create like
    await Like.create({ user: userId, video: videoId, type: 'like' });
    return res.status(201).json(
      new ApiResponse(201, { reaction: 'like' }, "Video liked successfully")
    );
  }

  if (existingReaction.type === 'like') {
    // Already liked - remove like
    await Like.findByIdAndDelete(existingReaction._id);
    return res.status(200).json(
      new ApiResponse(200, { reaction: null }, "Like removed successfully")
    );
  }

  // Currently disliked - change to like
  existingReaction.type = 'like';
  await existingReaction.save();
  return res.status(200).json(
    new ApiResponse(200, { reaction: 'like' }, "Changed to like successfully")
  );
});

// Toggle dislike on a video
export const toggleDislike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  // Check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check existing reaction
  const existingReaction = await Like.findOne({ user: userId, video: videoId });

  if (!existingReaction) {
    // No reaction yet - create dislike
    await Like.create({ user: userId, video: videoId, type: 'dislike' });
    return res.status(201).json(
      new ApiResponse(201, { reaction: 'dislike' }, "Video disliked successfully")
    );
  }

  if (existingReaction.type === 'dislike') {
    // Already disliked - remove dislike
    await Like.findByIdAndDelete(existingReaction._id);
    return res.status(200).json(
      new ApiResponse(200, { reaction: null }, "Dislike removed successfully")
    );
  }

  // Currently liked - change to dislike
  existingReaction.type = 'dislike';
  await existingReaction.save();
  return res.status(200).json(
    new ApiResponse(200, { reaction: 'dislike' }, "Changed to dislike successfully")
  );
});

// Get video reactions (likes/dislikes count and user's reaction)
export const getVideoReactions = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // Count likes and dislikes
  const [likesCount, dislikesCount] = await Promise.all([
    Like.countDocuments({ video: videoId, type: 'like' }),
    Like.countDocuments({ video: videoId, type: 'dislike' })
  ]);

  // Get user's reaction if authenticated
  let userReaction = null;
  if (req.user) {
    const reaction = await Like.findOne({ user: req.user._id, video: videoId });
    userReaction = reaction ? reaction.type : null;
  }

  return res.status(200).json(
    new ApiResponse(200, {
      likes: likesCount,
      dislikes: dislikesCount,
      userReaction
    }, "Reactions fetched successfully")
  );
});
// Search videos by query string
export const searchVideos = asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 12 } = req.query;

    if (!q || !q.trim()) {
        throw new ApiError(400, "Search query is required");
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), 'i'); // Case-insensitive search

    // Build match query - search in title, description, and owner username
    const matchQuery = {
        isPublished: true,
        isApproved: true,
        $or: [
            { title: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
            { "owner.username": { $regex: searchRegex } }
        ]
    };

    // Get videos and total count
    const [videos, total] = await Promise.all([
        Video.find(matchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Video.countDocuments(matchQuery)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json(
        new ApiResponse(200, {
            videos,
            pagination: {
                query: q,
                currentPage: parseInt(page),
                totalPages,
                totalResults: total,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            }
        }, `Found ${total} videos matching "${q}"`)
    );
});
