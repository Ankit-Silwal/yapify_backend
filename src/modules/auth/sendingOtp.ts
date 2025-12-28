import { transporter } from "../../config/nodemailer.js";

export async function sendRegisterMail({ to, otp }: { to: string; otp: string }) {
  await transporter.sendMail({
    from: `"Yapify-"The whatsApp clone" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your OTP Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 32px;">
        <div style="max-width: 400px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
          <h2 style="color: #4F8EF7; text-align: center;">Verify Your Email</h2>
          <p style="font-size: 16px; color: #333; text-align: center;">
            Use the following OTP to complete your verification:
          </p>
          <div style="font-size: 32px; font-weight: bold; color: #222; background: #f1f7ff; border-radius: 6px; padding: 16px; text-align: center; letter-spacing: 8px; margin: 24px 0;">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #888; text-align: center;">
            This code will expire in a few minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      </div>
    `
  });
}
