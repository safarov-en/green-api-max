export class GreenApiService {
  constructor(idInstance, apiTokenInstance, host = 'https://api.green-api.com') {
    this.idInstance = idInstance.trim();
    this.apiTokenInstance = apiTokenInstance.trim();
    this.baseUrl = `${host}/waInstance${this.idInstance}`;
  }

  async sendMessage(chatId, message) {
    const url = `${this.baseUrl}/sendMessage/${this.apiTokenInstance}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка отправки сообщения: ${response.statusText}`);
    }
    return response.json();
  }

  async receiveNotification() {
    const url = `${this.baseUrl}/receiveNotification/${this.apiTokenInstance}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Ошибка получения уведомлений: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async deleteNotification(receiptId) {
    const url = `${this.baseUrl}/deleteNotification/${this.apiTokenInstance}/${receiptId}`;
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Ошибка удаления уведомления: ${response.statusText}`);
    }

    const text = await response.text();
    return text && text.trim() !== '' ? JSON.parse(text) : null;
  }
}