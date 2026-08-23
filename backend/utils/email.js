import nodemailer from 'nodemailer';

let transporter;

// Initialize Transporter
const getTransporter = async () => {
  if (transporter) return transporter;

  const hasSMTPConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (hasSMTPConfig) {
    console.log('[Email] Configuring SMTP using environment variables...');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    console.log('[Email] No SMTP configuration found. Creating mock Ethereal SMTP transporter...');
    // Create Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    // Set environment variables for future calls
    process.env.SMTP_USER = testAccount.user;
    process.env.SMTP_PASS = testAccount.pass;
  }

  return transporter;
};

/**
 * Sends a ticket confirmation email.
 * 
 * @param {object} options
 * @param {string} options.to Email address
 * @param {string} options.userName User's name
 * @param {string} options.showTitle Concert/Show Title
 * @param {string} options.venue Venue details
 * @param {string} options.showTime Time of show
 * @param {array} options.seatNumbers List of seat numbers booked (e.g. ['A1', 'A2'])
 * @param {number} options.totalPrice Total price paid
 * @param {string} options.qrCodeDataUrl Base64 QR code image string
 */
export const sendTicketConfirmationEmail = async ({
  to,
  userName,
  showTitle,
  venue,
  showTime,
  seatNumbers,
  totalPrice,
  qrCodeDataUrl,
}) => {
  try {
    const activeTransporter = await getTransporter();
    const fromAddress = process.env.SMTP_FROM || 'tickets@example.com';

    // Format date nicely
    const dateFormatted = new Date(showTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const mailOptions = {
      from: `"Concert Tickets" <${fromAddress}>`,
      to,
      subject: `Your Tickets are Confirmed: ${showTitle}! 🎫`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #6b21a8; text-align: center; margin-bottom: 24px;">Booking Confirmed! 🎫</h2>
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Your tickets have been successfully booked and confirmed. Here is your order summary:</p>
          
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e293b;">${showTitle}</h3>
            <p style="margin: 4px 0;">📍 <strong>Venue:</strong> ${venue}</p>
            <p style="margin: 4px 0;">📅 <strong>Date & Time:</strong> ${dateFormatted}</p>
            <p style="margin: 4px 0;">💺 <strong>Seats:</strong> ${seatNumbers.join(', ')}</p>
            <p style="margin: 4px 0;">💰 <strong>Amount Paid:</strong> $${totalPrice}</p>
          </div>

          <p style="text-align: center; margin-top: 24px;">
            <strong>Scan this QR code at the entrance to gain entry:</strong>
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <!-- Embed base64 image as CID attachment to ensure compatibility -->
            <img src="cid:qrcode" alt="Entry Ticket QR Code" style="border: 2px solid #e2e8f0; padding: 8px; border-radius: 4px; background: white;" width="180" height="180" />
          </div>

          <p style="font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Please have your QR code ready on your phone upon arrival. Thank you for your purchase!
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'ticket-qrcode.png',
          path: qrCodeDataUrl, // base64 URI
          cid: 'qrcode', // links to <img src="cid:qrcode">
        },
      ],
    };

    const info = await activeTransporter.sendMail(mailOptions);
    console.log(`[Email] Ticket confirmation email sent to ${to}. Message ID: ${info.messageId}`);
    
    // Log Ethereal URL if using preview account
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`[Email] Preview Ethereal Message: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (error) {
    console.error('[Email] Failed to send ticket confirmation email:', error);
    throw error;
  }
};
