import React, { useState, useEffect, useRef } from "react";
import { getMessages, sendMessage, markMessagesRead, uploadChatImage } from "../api";
import { useAuth } from "../AuthContext";

export default function Chat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  
  const scrollRef = useRef();
  const fileInputRef = useRef();
  const prevCount = useRef(0);

  // Dragging State
  const [pos, setPos] = useState({ x: 25, y: 25 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [moved, setMoved] = useState(false);

  const playSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;
    const fetchMsgs = async () => {
      try {
        const data = await getMessages();
        setMessages(data);
        const unreadList = data.filter(m => String(m.is_read) !== "1" && m.sender_role !== user.role);
        const count = unreadList.length;
        if (!isOpen && count > prevCount.current) playSound();
        prevCount.current = count;
        setUnreadCount(isOpen ? 0 : count);
      } catch (e) {}
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 4000);
    return () => clearInterval(interval);
  }, [user, isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      markMessagesRead().then(() => {
        setUnreadCount(0);
        prevCount.current = 0;
      }).catch(() => {});
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages.length]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setMoved(false);
    setDragStart({ x: e.clientX - pos.x, y: (window.innerHeight - e.clientY) - pos.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setMoved(true);
    let newX = e.clientX - dragStart.x;
    let newY = (window.innerHeight - e.clientY) - dragStart.y;
    newX = Math.max(10, Math.min(window.innerWidth - 70, newX));
    newY = Math.max(10, Math.min(window.innerHeight - 70, newY));
    setPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText("");
    try {
      await sendMessage(msg);
      const data = await getMessages();
      setMessages(data);
    } catch (e) { setText(msg); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadChatImage(formData);
      await sendMessage("", res.url);
      const data = await getMessages();
      setMessages(data);
    } catch (err) { 
      alert("فشل رفع الصورة: " + (err.message || "خطأ مجهول"));
      console.error("Upload Error:", err);
    }
    setIsUploading(false);
  };

  if (!user) return null;

  return (
    <div style={{ fontFamily: 'inherit' }} dir="rtl">
      {/* Draggable FAB */}
      <button 
        style={{
          position: 'fixed', bottom: `${pos.y}px`, left: `${pos.x}px`, width: '60px', height: '60px',
          borderRadius: '50%', background: 'linear-gradient(135deg, #0061ff 0%, #6033ff 100%)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab', zIndex: 999999, transition: isDragging ? 'none' : 'all 0.1s ease', border: 'none', color: '#fff',
          touchAction: 'none'
        }} 
        onMouseDown={handleMouseDown} 
        onClick={() => { if (!moved) setIsOpen(!isOpen); }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: '0px', right: '0px', background: '#ff3b30', color: '#fff',
            width: '26px', height: '26px', borderRadius: '50%', fontSize: '13px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
            boxShadow: '0 4px 12px rgba(255,59,48,0.7)', animation: 'pulseBadge 1.2s infinite', zIndex: 1000000
          }}>{unreadCount}</div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: `${pos.y + 75}px`, left: `${pos.x}px`, width: '350px', height: '500px',
          background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(30px)', borderRadius: '24px',
          boxShadow: '0 25px 70px rgba(0,0,0,0.3)', border: '1px solid rgba(0,0,0,0.05)',
          zIndex: 999999, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp 0.3s ease'
        }}>
          {/* Header */}
          <div style={{ padding: '15px 20px', background: 'linear-gradient(90deg, #0061ff, #6033ff)', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#2ecc71', borderRadius: '50%', boxShadow: '0 0 8px #2ecc71' }} />
              <span style={{ fontSize: '14px' }}>المحادثة الداخلية</span>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }} ref={scrollRef}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_role === user.role ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '85%', padding: m.image_url ? '6px' : '10px 14px', borderRadius: '18px', fontSize: '13px',
                  background: m.sender_role === user.role ? '#0061ff' : '#fff',
                  color: m.sender_role === user.role ? '#fff' : '#333',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  borderBottomRightRadius: m.sender_role === user.role ? '2px' : '18px',
                  borderBottomLeftRadius: m.sender_role !== user.role ? '2px' : '18px',
                  border: m.sender_role !== user.role ? '1px solid #eee' : 'none',
                  overflow: 'hidden'
                }}>
                  {m.image_url && (
                    <img 
                      src={m.image_url} 
                      alt="Chat Attachment" 
                      style={{ width: '100%', borderRadius: '12px', cursor: 'pointer', display: 'block', marginBottom: m.content ? '8px' : '0' }} 
                      onClick={() => setZoomImg(m.image_url)}
                    />
                  )}
                  {m.content}
                </div>
                <span style={{ fontSize: '9px', color: '#aaa', marginTop: '4px', padding: '0 6px' }}>
                  {m.sender_role === 'doctor' ? 'طبيب' : 'سكرتارية'} • {m.created_at.split(' ')[1]?.substring(0,5)}
                </span>
              </div>
            ))}
            {isUploading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px', background: '#f0f0f0', borderRadius: '12px', fontSize: '12px' }}>جاري رفع الصورة...</div>
            )}
          </div>

          {/* Input Area */}
          <form style={{ padding: '15px', borderTop: '1px solid #eee', display: 'flex', gap: '10px', background: '#fff' }} onSubmit={handleSend}>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
            <button 
              type="button" 
              onClick={() => fileInputRef.current.click()}
              style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f0f0f0', color: '#666', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input 
              style={{ flex: 1, padding: '12px 16px', borderRadius: '14px', border: '1px solid #eee', background: '#f8f9fa', outline: 'none', fontSize: '13px' }} 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder="اكتب رسالة..." 
            />
            <button style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#0061ff', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} type="submit" disabled={!text.trim() && !isUploading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(-45)"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </form>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImg && (
        <div 
          onClick={() => setZoomImg(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000001, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '40px' }}
        >
          <img src={zoomImg} alt="Zoomed" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />
          <button style={{ position: 'absolute', top: '20px', left: '20px', background: '#fff', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulseBadge { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
