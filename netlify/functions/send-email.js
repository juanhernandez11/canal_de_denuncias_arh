const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { to, subject, text, html, attachments } = JSON.parse(event.body);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Canal de Denuncias 🔐" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
      attachments: (attachments || []).map((a) => ({
        filename: a.name,
        path: a.data,
      })),
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Email sent successfully' }) };
  } catch (error) {
    console.error('Error sending email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
