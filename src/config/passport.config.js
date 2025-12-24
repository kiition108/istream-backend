import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user.model.js';

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // User exists, return user
                    return done(null, user);
                }

                // Check if user exists with same email
                user = await User.findOne({ email: profile.emails[0].value });

                if (user) {
                    // Link Google account to existing user
                    user.googleId = profile.id;
                    user.authProvider = 'google';
                    await user.save();
                    return done(null, user);
                }

                // Create new user
                const newUser = await User.create({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    fullName: profile.displayName,
                    username: profile.emails[0].value.split('@')[0] + '_' + Date.now(),
                    avatar: profile.photos[0]?.value || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=random&size=200`,
                    authProvider: 'google',
                    isVerified: true, // Google users are pre-verified
                    role: 'user'
                });

                return done(null, newUser);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password -refreshToken');
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
