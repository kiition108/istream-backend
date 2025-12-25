import mongoose, { Schema } from 'mongoose';

const likeSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'dislike'],
        required: true
    }
}, { timestamps: true });

// Compound index to ensure one reaction per user per video
likeSchema.index({ user: 1, video: 1 }, { unique: true });

export const Like = mongoose.model('Like', likeSchema);
