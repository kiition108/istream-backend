import { Subscription } from '../models/subscription.model.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const subscribeToChannel = asyncHandler(async (req, res) => {
  const channelId = req.params.channelId
  const userId = req.user._id
  
  if (userId.toString() === channelId) {
    throw new ApiError(400, "You cannot subscribe to yourself.")
  }

  const alreadySubscribed = await Subscription.findOne({
    subscriber: userId,
    channel: channelId
  })

  if (alreadySubscribed) {
    throw new ApiError(400, "Already subscribed to this channel.")
  }

  await Subscription.create({ subscriber: userId, channel: channelId })

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Subscribed successfully"))
})

export const unsubscribeFromChannel = asyncHandler(async (req, res) => {
  const channelId = req.params.channelId
  const userId = req.user._id

  const result = await Subscription.findOneAndDelete({
    subscriber: userId,
    channel: channelId
  })

  if (!result) {
    throw new ApiError(400, "Not subscribed to this channel.")
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Unsubscribed successfully"))
})
