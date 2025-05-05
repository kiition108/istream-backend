import nodemailer from "nodemailer";

export const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail", // or use another SMTP
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"iStream" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify your Email - iStream",
    html: `<p>Your OTP for email verification is: <strong>${otp}</strong>. It is valid for 10 minutes.</p>`,
  };

  await transporter.sendMail(mailOptions);
};
