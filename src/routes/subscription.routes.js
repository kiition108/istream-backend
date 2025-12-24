import express from 'express'
import { getSubscriptions, subscribeToChannel, unsubscribeFromChannel } from '../controllers/subscription.controller.js'
import { verifyJWT } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.get('/get-subscriptions', verifyJWT, getSubscriptions)
router.post('/:channelId', verifyJWT, subscribeToChannel)
router.delete('/:channelId', verifyJWT, unsubscribeFromChannel)

export default router
