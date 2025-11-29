const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS required for emails');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporter;
};

const sendOtpEmail = async (to, otp) => {
  const from = 'no-reply@pitchperfect.eu.com';
  const transporterInstance = getTransporter();

  const mailOptions = {
    from,
    to,
    subject: 'PitchPerfect OTP Verification',
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your PitchPerfect OTP</h2>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f0f0f0; padding: 20px; text-align: center;">
        ${otp}
      </p>
      <p>This code is valid for 10 minutes.</p>
      <hr>
      <p>If you didn't request this, ignore this email.</p>
    </div>`,
  };

  try {
    await transporterInstance.sendMail(mailOptions);
    console.log(`[OTP SENT] To ${to}: ${otp}`);
  } catch (err) {
    console.error(`[EMAIL ERROR] Failed to send to ${to}:`, err.message);
    throw err;
  }
};

module.exports = { sendOtpEmail };
