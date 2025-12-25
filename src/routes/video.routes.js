import express from 'express';
import {
  uploadVideo,
  listVideos,
  getUserVideos,
  updateVideo,
  getVideoById,
  toggleApproval,
  togglePrivacy,
  deleteVideo,
  getVideoForAdminAndOwnerById,
  approvedListedVideos,
  addComment,
  getComment,
  recordView,
  toggleLike,
  toggleDislike,
  getVideoReactions,
  searchVideos
} from '../controllers/video.controller.js';
import { videoUpload } from '../middlewares/multer.middleware.js';
import { verifyJWT, optionalAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// video upload route
router.post(
  '/videoUpload',
  verifyJWT,
  videoUpload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  uploadVideo
);

// video listing
router.get('/album', approvedListedVideos);
router.get("/user", verifyJWT, getUserVideos);
router.get("/pendingVideos", verifyJWT, listVideos)

// Search videos
router.get('/search', searchVideos);

// Specific routes BEFORE parameterized routes
router.get('/adminOwner/:id', verifyJWT, getVideoForAdminAndOwnerById)

// get a single video by ID - MUST come after specific routes
router.get('/:id', getVideoById);

// toggle approval (admin)
router.put('/approval/:videoId', verifyJWT, toggleApproval);

// toggle privacy (owner)
router.put('/privacy/:videoId', verifyJWT, togglePrivacy);

// delete video
router.delete('/:videoId', verifyJWT, deleteVideo);

//edit video
router.put(
  '/:id',
  verifyJWT,
  videoUpload.single('thumbnail'), // Handles 'thumbnail' field
  updateVideo
);

//comments
//add comment
router.post('/:videoId/comments', verifyJWT, addComment);
//get comments
router.get('/:videoId/comments', getComment);

// Record video view and add to watch history
router.post('/:videoId/view', optionalAuth, recordView);

// Like/Dislike endpoints
router.post('/:videoId/like', verifyJWT, toggleLike);
router.post('/:videoId/dislike', verifyJWT, toggleDislike);
router.get('/:videoId/reactions', optionalAuth, getVideoReactions);
export default router;
