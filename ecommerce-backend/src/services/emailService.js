const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOrderConfirmationEmail({ toEmail, customerName, orderId, items, totalAmount }) {
  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">₹${item.price}</td>
        </tr>`
    )
    .join('');

  try {
    const { data, error } = await resend.emails.send({
      from: 'Your Store <onboarding@resend.dev>', // swap to your verified domain later
      to: toEmail,
      subject: `Order Confirmed — #${orderId}`,
      html: `
        <h2>Thanks for your order, ${customerName}!</h2>
        <p>Your order <strong>#${orderId}</strong> has been confirmed.</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Item</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Qty</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="margin-top:16px;"><strong>Total: ₹${totalAmount}</strong></p>
        <p>We'll notify you when your order ships.</p>
      `
    });

    if (error) {
      console.error('Resend email error:', error);
      return;
    }
    console.log('Order confirmation email sent:', data.id);
  } catch (err) {
    console.error('Failed to send order confirmation email:', err.message);
  }
}

module.exports = { sendOrderConfirmationEmail };