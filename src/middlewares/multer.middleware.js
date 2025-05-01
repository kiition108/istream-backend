import multer from "multer"
import fs from "fs"
// Storage for video files
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = file.fieldname === "videoFile" ? "videos" : "thumbnails";
    const tmpdir=`./public/temp/${folder}`
      fs.mkdirSync(tmpdir, { recursive: true });
      cb(null, tmpdir)
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["video/mp4", "image/jpeg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};
const storage = multer.diskStorage({

    destination: function (req, file, cb) {
    const folder = file.fieldname === "avatar" ? "avatar" : "coverImage";
     const tmpdir=`./public/temp/${folder}`
      fs.mkdirSync(tmpdir, { recursive: true });
      cb(null, tmpdir)
    },
    filename: function (req, file, cb) {
      
      cb(null, file.originalname)
    }
  })
  
  export const upload = multer({ 
    storage,
})
export const videoUpload = multer({
  storage: videoStorage,
  fileFilter,
});