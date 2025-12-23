import mongoose, { Schema } from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'

const commentSchema = new mongoose.Schema(
   {
      user: {
         _id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
         username: String,
         avatar: String,
      },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
   },
   { _id: false }
);
const videoSchema = new Schema({
   videoFile: {
      type: String,
      required: true
   },
   videoPublicId: {
      type: String
   }, // for deletion
   thumbnail: {
      type: String,
      required: true
   },
   thumbnailPublicId: {
      type: String
   },
   title: {
      type: String,
      required: true
   },
   description: {
      type: String,
      required: true
   },
   duration: {
      type: String,

   },
   views: {
      type: Number,
      default: 0
   },
   isPublished: {
      type: Boolean,
      default: true
   },
   isApproved: {
      type: Boolean,
      default: false
   }, // admin toggle
   owner: {
      _id: {
         type: Schema.Types.ObjectId,
         ref: "User"
      },
      username: {
         type: String,
         ref: "User"
      },
      avatar: {
         type: String,
         ref: "User"
      },
   },
   comments: [commentSchema]


}, { timestamps: true })


videoSchema.plugin(mongooseAggregatePaginate)
export const Video = mongoose.model("Video", videoSchema)