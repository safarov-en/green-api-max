import { useState, useEffect, useRef } from 'react';
import { GreenApiService } from './api/greenApi';
import './App.css';

function App() {
  const [credentials, setCredentials] = useState(() => {
    const saved = localStorage.getItem('green_credentials');
    return saved ? JSON.parse(saved) : null;
  });

  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [hostUrl, setHostUrl] = useState('https://api.green-api.com');

  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('green_chats');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeChat, setActiveChat] = useState(() => {
    return localStorage.getItem('green_active_chat') || null;
  });
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('green_messages');
    return saved ? JSON.parse(saved) : {};
  });

  const [newChatPhone, setNewChatPhone] = useState('');
  const [inputText, setInputText] = useState('');

  const messagesEndRef = useRef(null);
  const apiServiceRef = useRef(null);

  useEffect(() => {
    if (credentials) {
      apiServiceRef.current = new GreenApiService(
        credentials.idInstance,
        credentials.apiTokenInstance,
        credentials.hostUrl
      );
    }
  }, [credentials]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  useEffect(() => {
    if (!credentials) return;

    let isPolling = true;

    const pollNotifications = async () => {
      while (isPolling) {
        try {
          if (!apiServiceRef.current) break;

          const response = await apiServiceRef.current.receiveNotification();

          if (!response) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          const { receiptId, body } = response;

          if (body?.typeWebhook === 'incomingMessageReceived') {
            const chatId = body.senderData?.chatId;
            const messageData = body.messageData;

            const text =
              messageData?.textMessageData?.textMessage ||
              messageData?.extendedTextMessageData?.text;

            if (chatId && text) {
              setChats((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));

              setMessages((prev) => ({
                ...prev,
                [chatId]: [
                  ...(prev[chatId] || []),
                  {
                    id: body.idMessage || Date.now(),
                    text,
                    type: 'incoming',
                    timestamp: new Date(body.timestamp * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  },
                ],
              }));
            }
          }

          await apiServiceRef.current.deleteNotification(receiptId);
        } catch (error) {
          console.error('Ошибка в polling notifications:', error);
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    };

    pollNotifications();

    return () => {
      isPolling = false;
    };
  }, [credentials]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!idInstance || !apiTokenInstance) {
      alert('Заполните idInstance и apiTokenInstance!');
      return;
    }
    const creds = { idInstance, apiTokenInstance, hostUrl };
    setCredentials(creds);
    localStorage.setItem('green_credentials', JSON.stringify(creds));
  };

  const handleLogout = () => {
    setCredentials(null);
    localStorage.removeItem('green_credentials');
    setChats([]);
    setActiveChat(null);
    setMessages({});
    localStorage.removeItem('green_chats');
    localStorage.removeItem('green_messages');
    localStorage.removeItem('green_active_chat');
  };

  const handleCreateChat = (e) => {
    e.preventDefault();

    const cleanPhone = newChatPhone.replace(/[^\d]/g, '');

    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      alert('Пожалуйста, введите корректный номер телефона в международном формате (от 8 до 15 цифр).');
      return;
    }

    const chatId = `${cleanPhone}@c.us`;

    if (!chats.includes(chatId)) {
      setChats((prev) => [...prev, chatId]);
    }
    setActiveChat(chatId);
    setNewChatPhone('');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat || !apiServiceRef.current) return;

    const messageToSend = inputText.trim();
    setInputText('');

    try {
      const newMessage = {
        id: Date.now().toString(),
        text: messageToSend,
        type: 'outgoing',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => ({
        ...prev,
        [activeChat]: [...(prev[activeChat] || []), newMessage],
      }));

      await apiServiceRef.current.sendMessage(activeChat, messageToSend);
    } catch (error) {
      console.error('Не удалось отправить сообщение:', error);
      alert('Ошибка при отправке сообщения: ' + error.message);
    }
  };

  useEffect(() => {
    localStorage.setItem('green_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChat) {
      localStorage.setItem('green_active_chat', activeChat);
    } else {
      localStorage.removeItem('green_active_chat');
    }
  }, [activeChat]);

  useEffect(() => {
    localStorage.setItem('green_messages', JSON.stringify(messages));
  }, [messages]);

  if (!credentials) {
    return (
      <div className="login-container">
        <h2>GREEN-API Чат</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>API Url (Host):</label>
            <input
              type="text"
              value={hostUrl}
              onChange={(e) => setHostUrl(e.target.value)}
              placeholder="https://api.green-api.com"
            />
          </div>
          <div className="form-group">
            <label>idInstance:</label>
            <input
              type="text"
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value)}
              placeholder="Например: 1101000001"
              required
            />
          </div>
          <div className="form-group">
            <label>apiTokenInstance:</label>
            <input
              type="password"
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              placeholder="Введите токен"
              required
            />
          </div>
          <button type="submit" className="btn-primary">
            Войти
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>Инстанс: {credentials.idInstance}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#d32f2f',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Выйти
          </button>
        </div>

        <div className="new-chat-section">
          <form onSubmit={handleCreateChat} className="new-chat-input">
            <input
              type="text"
              placeholder="Телефон (79991234567)"
              value={newChatPhone}
              onChange={(e) => setNewChatPhone(e.target.value)}
            />
            <button type="submit">+</button>
          </form>
        </div>

        <div className="chat-list">
          {chats.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#8696a0' }}>
              Нет открытых чатов. Введите номер выше, чтобы начать диалог.
            </div>
          )}
          {chats.map((chatId) => (
            <div
              key={chatId}
              className={`chat-item ${activeChat === chatId ? 'active' : ''}`}
              onClick={() => setActiveChat(chatId)}
            >
              <div className="chat-item-avatar">
                {chatId.slice(0, 2).toUpperCase()}
              </div>
              <div className="chat-item-info">
                <div style={{ fontWeight: 500 }}>{chatId.replace('@c.us', '')}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-window">
        {activeChat ? (
          <>
            <div className="chat-header">
              <div className="chat-item-avatar">
                {activeChat.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>{activeChat.replace('@c.us', '')}</strong>
              </div>
            </div>

            <div className="chat-messages">
              {(messages[activeChat] || []).map((msg) => (
                <div key={msg.id} className={`message ${msg.type}`}>
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{msg.timestamp}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
              <input
                type="text"
                placeholder="Введите текстовое сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
                Отправить
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            Выберите чат или создайте новый, чтобы начать общение
          </div>
        )}
      </main>
    </div>
  );
}

export default App;