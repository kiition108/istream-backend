import express from 'express'
import { getSubscriptions, subscriptionStatus, subscribeToChannel, unsubscribeFromChannel } from '../controllers/subscription.controller.js'
import { verifyJWT } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.get('/', verifyJWT, getSubscriptions)
router.get('/status/:channelId', verifyJWT, subscriptionStatus)
router.post('/:channelId', verifyJWT, subscribeToChannel)
router.delete('/:channelId', verifyJWT, unsubscribeFromChannel)

export default router
