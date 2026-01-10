import { Resend } from 'resend';

const resend = new Resend(process.env.ISTREAM_OTP_SERVICE_API_KEY);

export const sendOTPEmail = async (email, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'iStream <noreply@spendtrail.app>', // Use your verified domain or resend.dev for testing
      to: [email],
      subject: "Verify your Email - iStream",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .otp-box { background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }
              .otp-code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; }
              .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Verify Your Email</h2>
              <p>Thank you for signing up with iStream! Please use the OTP below to verify your email address.</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
              <p>If you didn't request this verification, please ignore this email.</p>
              <div class="footer">
                <p>© ${new Date().getFullYear()} iStream. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};
