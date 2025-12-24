import { Subscription } from '../models/subscription.model.js'
import { User } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const getSubscriptions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 9
  const skip = (page - 1) * limit
  const total = await Subscription.countDocuments({ "subscriber._id": req.user._id })
  const totalPages = Math.ceil(total / limit)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1
  const subscriptions = await Subscription.find({ "subscriber._id": req.user._id })
    .skip(skip)
    .limit(limit)
    .populate("channel", "_id username avatar coverImage")
    .populate("subscriber", "_id username avatar")
    .sort({ createdAt: -1 })
  return res
    .status(200)
    .json(new ApiResponse(200, subscriptions, { hasNextPage, hasPrevPage, totalPages }, "Subscriptions retrieved successfully"))
})
export const subscribeToChannel = asyncHandler(async (req, res) => {
  const channelId = req.params.channelId
  const userId = req.user._id

  if (userId.toString() === channelId) {
    throw new ApiError(400, "You cannot subscribe to yourself.")
  }

  const alreadySubscribed = await Subscription.findOne({
    "subscriber._id": userId,
    "channel._id": channelId
  })

  if (alreadySubscribed) {
    throw new ApiError(400, "Already subscribed to this channel.")
  }

  // Fetch user details
  const [subscriber, channel] = await Promise.all([
    User.findById(userId).select('username avatar').lean(),
    User.findById(channelId).select('username avatar coverImage').lean()
  ]);

  if (!channel) {
    throw new ApiError(404, "Channel not found")
  }

  await Subscription.create({
    subscriber: {
      _id: userId,
      username: subscriber.username,
      avatar: subscriber.avatar
    },
    channel: {
      _id: channelId,
      username: channel.username,
      avatar: channel.avatar,
      coverImage: channel.coverImage || ''
    }
  })

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Subscribed successfully"))
})

export const unsubscribeFromChannel = asyncHandler(async (req, res) => {
  const channelId = req.params.channelId
  const userId = req.user._id

  const result = await Subscription.findOneAndDelete({
    "subscriber._id": userId,
    "channel._id": channelId
  })

  if (!result) {
    throw new ApiError(400, "Not subscribed to this channel.")
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Unsubscribed successfully"))
})
