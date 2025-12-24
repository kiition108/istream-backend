import mongoose, { Schema } from 'mongoose'

const subsriptionSchema = new Schema({
    subscriber: {
        _id: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        username: {
            type: String,
            required: true
        },
        avatar: {
            type: String,
            required: true
        }
    },
    channel: {
        _id: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        username: {
            type: String,
            required: true
        },
        avatar: {
            type: String,
            required: true
        },
        coverImage: {
            type: String,
            required: true
        }
    }

}, { timestamps: true })

export const Subscription = mongoose.model("Subscription", subsriptionSchema)