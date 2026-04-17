const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "27769961477";

export interface BookingData {
  name: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  venue: string;
  budget?: string;
  services?: string[];
  message?: string;
}

export interface OrderData {
  customerName: string;
  customerPhone: string;
  items: {
    name: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }[];
  total: number;
}

export interface TicketOrderData {
  customerName: string;
  customerPhone: string;
  eventTitle: string;
  eventDate: string;
  tickets: {
    type: string;
    quantity: number;
    price: number;
  }[];
  total: number;
}

export function createBookingMessage(data: BookingData): string {
  let message = `🎵 *TSAKANI SESSIONS BOOKING REQUEST* 🎵\n\n`;
  message += `👤 *Name:* ${data.name}\n`;
  message += `📧 *Email:* ${data.email}\n`;
  message += `📱 *Phone:* ${data.phone}\n\n`;
  message += `🎉 *Event Type:* ${data.eventType}\n`;
  message += `📅 *Date:* ${data.eventDate}\n`;
  message += `📍 *Venue:* ${data.venue}\n`;

  if (data.budget) {
    message += `💰 *Budget:* ${data.budget}\n`;
  }

  if (data.services && data.services.length > 0) {
    message += `🎛️ *Services Needed:* ${data.services.join(", ")}\n`;
  }

  if (data.message) {
    message += `\n📝 *Additional Details:*\n${data.message}\n`;
  }

  message += `\n✨ Looking forward to creating an amazing experience together!`;
  return message;
}

export function createOrderMessage(data: OrderData): string {
  let message = `🛒 *TSAKANI SESSIONS MERCH ORDER* 🛒\n\n`;
  message += `👤 *Name:* ${data.customerName}\n`;
  message += `📱 *Phone:* ${data.customerPhone}\n\n`;
  message += `📦 *Items:*\n`;

  data.items.forEach((item) => {
    message += `  • ${item.name} (${item.size}, ${item.color}) x${item.quantity} — R${item.price * item.quantity}\n`;
  });

  message += `\n💰 *Total:* R${data.total}\n`;
  message += `\n🙏 Please confirm availability and payment details.`;
  return message;
}

export function createTicketOrderMessage(data: TicketOrderData): string {
  let message = `🎟️ *TSAKANI SESSIONS TICKET ORDER* 🎟️\n\n`;
  message += `👤 *Name:* ${data.customerName}\n`;
  message += `📱 *Phone:* ${data.customerPhone}\n\n`;
  message += `🎉 *Event:* ${data.eventTitle}\n`;
  message += `📅 *Date:* ${data.eventDate}\n\n`;
  message += `🎫 *Tickets:*\n`;

  data.tickets.forEach((ticket) => {
    message += `  • ${ticket.type} x${ticket.quantity} — R${ticket.price * ticket.quantity}\n`;
  });

  message += `\n💰 *Total:* R${data.total}\n`;
  message += `\n🙏 Please confirm and send payment details.`;
  return message;
}

export function openWhatsApp(message: string): void {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}
