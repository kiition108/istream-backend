import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import passport from './config/passport.config.js';




const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cookieParser())
app.use(passport.initialize());
app.set('trust proxy', 1); // ✅ Necessary for secure cookies to work behind Render proxy



//routes import

import userRouter from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import errorHandler from "./utils/errorHandler.js"
// routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/video", videoRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use(errorHandler);
export { app }