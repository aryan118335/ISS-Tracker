import { useState, useEffect, useRef } from 'react';
import './ChatBot.css';

export default function ChatBot({ issData, newsData, astronauts }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages.slice(-30)));
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const lat = issData?.position?.lat ?? 'unknown';
    const lng = issData?.position?.lng ?? 'unknown';
    const speed = issData?.speed ?? 'unknown';
    const top5headlines = (newsData || []).slice(0, 5).map(n => n.title).join(", ");

    const systemPrompt = `You are a dashboard assistant. You ONLY answer questions about ISS location, ISS speed, astronauts in space, and news articles shown on this dashboard. 
    Current ISS data: Lat ${lat}, Lng ${lng}, Speed ${speed} km/h. 
    Astronauts in space: ${astronauts || 'unknown'}. 
    News headlines: ${top5headlines}. 
    If asked anything else, say: I only know dashboard data.`;

    try {
      const response = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-10),
              userMessage
            ],
            model: "mistralai/Mistral-7B-Instruct-v0.2:featherless-ai",
            max_tokens: 500,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', response.status, errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const aiMessage = {
        role: 'assistant',
        content: data.choices[0].message.content,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('chat_history');
  };

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      {/* Floating Button */}
      <button 
        className="chatbot-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close Chat" : "Open AI Assistant"}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-info">
              <h3>AI Assistant</h3>
              <span className="online-status">● Online</span>
            </div>
            <button className="clear-btn" onClick={clearChat} title="Clear Chat History">
              🗑️
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-chat">
                <p>Hello! I'm your ISS Dashboard assistant. Ask me about the current location, speed, or news!</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-bubble typing">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about ISS or News..."
              autoFocus
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
