import express from 'express';
import { uploadVideo, 
        listVideos, 
        getUserVideos, 
        updateVideo, 
        getVideoById, 
        toggleApproval, 
        togglePrivacy, 
        deleteVideo 
    } from '../controllers/video.controller.js';
import { videoUpload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

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
router.get('/album',verifyJWT, listVideos);
router.get("/user", verifyJWT, getUserVideos);
// get a single video by ID
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

export default router;
