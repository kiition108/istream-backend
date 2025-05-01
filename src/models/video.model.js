import mongoose, {Schema} from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'

const videoSchema= new Schema({
 videoFile:{
    type: String,
    required: true
 },
 videoPublicId: { 
   type: String 
}, // for deletion
 thumbnail:{
    type:String,
    required: true
 },
 thumbnailPublicId: { 
   type: String 
},
 title:{
    type:String,
    required: true
 },
 description:{
    type:String,
    required: true
 },
 duration:{
    type:String,
    
 },
 views:{
    type:Number,
    default: 0
 },
 isPublished:{
    type: Boolean,
    default:true
 },
 isApproved: { 
   type: Boolean, 
   default: false 
}, // admin toggle
 owner:{
    type: Schema.Types.ObjectId,
    ref: "User"
 }


},{timestamps: true})


videoSchema.plugin(mongooseAggregatePaginate)
export const Video= mongoose.model("Video",videoSchema)