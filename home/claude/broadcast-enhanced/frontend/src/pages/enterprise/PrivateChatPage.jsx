import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import useAuthStore from "../../store/useAuthStore";
import usePrivateChatStore from "../../store/usePrivateChatStore";
import useCallStore from "../../store/useCallStore";
import { UserAvatar } from "../../components/layout/Navbar";
import { format } from "date-fns";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function PrivateChatPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();
  const { 
    users, activeChatUser, messages, isLoadingUsers, isLoadingMessages, 
    fetchUsers, setActiveChatUser, fetchMessages, sendMessage, receiveMessage, markMessagesReadByOther, updateUserStatus
  } = usePrivateChatStore();
  const { setCall } = useCallStore();

  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReceiveMessage = (msg) => {
      receiveMessage(msg);
      // If it's for the active chat, mark as read
      if (activeChatUser && msg.senderId._id === activeChatUser._id) {
        socket.emit("private_read", { senderId: msg.senderId._id });
      }
    };

    const handlePrivateTyping = ({ senderId, isTyping }) => {
      if (activeChatUser && activeChatUser._id === senderId) {
        setRemoteTyping(isTyping);
      }
    };

    const handleReadReceipt = ({ readerId }) => {
      markMessagesReadByOther(readerId);
    };

    const handleUserStatus = ({ userId, isOnline, lastSeen }) => {
      updateUserStatus({ userId, isOnline, lastSeen });
    };

    socket.on("receive_private_message", handleReceiveMessage);
    socket.on("private_typing", handlePrivateTyping);
    socket.on("private_read_receipt", handleReadReceipt);
    socket.on("user_status_change", handleUserStatus);

    return () => {
      socket.off("receive_private_message", handleReceiveMessage);
      socket.off("private_typing", handlePrivateTyping);
      socket.off("private_read_receipt", handleReadReceipt);
      socket.off("user_status_change", handleUserStatus);
    };
  }, [socket, isConnected, activeChatUser]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;

    const formData = new FormData();
    formData.append("content", newMessage);
    attachments.forEach((file) => formData.append("attachments", file));

    await sendMessage(activeChatUser._id, formData);
    setNewMessage("");
    setAttachments([]);
    
    if (socket) {
      socket.emit("private_typing", { receiverId: activeChatUser._id, isTyping: false });
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket || !activeChatUser) return;
    
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("private_typing", { receiverId: activeChatUser._id, isTyping: true });
    }
    
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("private_typing", { receiverId: activeChatUser._id, isTyping: false });
    }, 2000);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + attachments.length > 5) {
      toast.error("Max 5 attachments allowed");
      return;
    }
    setAttachments([...attachments, ...files]);
  };

  const initiateCall = async (type) => {
    if (!activeChatUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === "video", audio: true });
      setCall({
        isReceivingCall: false,
        caller: activeChatUser,
        type,
        stream,
      });
      // Further signaling is handled in CallOverlay.jsx
    } catch (err) {
      toast.error("Could not access camera/microphone.");
    }
  };

  const renderStatusTicks = (status) => {
    if (status === "sent") return <span className="text-slate-400">✓</span>;
    if (status === "delivered") return <span className="text-slate-400">✓✓</span>;
    if (status === "read") return <span className="text-blue-500">✓✓</span>;
    return null;
  };

  return (
    <div className="flex h-[calc(100dvh-56px)] bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${activeChatUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <button onClick={() => navigate(user?.role === "admin" ? "/admin" : "/dashboard")} className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full -ml-2 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Private Chat</h2>
            <p className="text-xs text-slate-500">{user?.role === "admin" ? "All Users" : "Admins Support"}</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoadingUsers ? (
            <div className="p-4 text-center text-slate-500">Loading...</div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-slate-500">No users found.</div>
          ) : (
            users.map((u) => (
              <div 
                key={u._id} 
                onClick={() => setActiveChatUser(u)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${activeChatUser?._id === u._id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
              >
                <div className="relative">
                  <UserAvatar user={u} />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${u.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{u.name}</h3>
                    {u.latestMessage && (
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {format(new Date(u.latestMessage.createdAt), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {u.latestMessage ? (
                        u.latestMessage.content || "📎 Attachment"
                      ) : "Start a conversation"}
                    </p>
                    {u.unreadCount > 0 && (
                      <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {u.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChatUser ? (
        <div className="flex-1 flex flex-col bg-[#e5ddd5] dark:bg-[#0b141a]">
          {/* Header */}
          <div className="h-16 px-4 bg-white dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveChatUser(null)}
                className="md:hidden text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full -ml-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <UserAvatar user={activeChatUser} />
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{activeChatUser.name}</h3>
                <p className="text-xs text-slate-500">
                  {activeChatUser.isOnline ? "Online" : `Last seen ${activeChatUser.lastSeen ? format(new Date(activeChatUser.lastSeen), "MMM d, HH:mm") : "recently"}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-brand-600 dark:text-brand-400">
              <button onClick={() => initiateCall("voice")} className="hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors" title="Voice Call">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </button>
              <button onClick={() => initiateCall("video")} className="hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors" title="Video Call">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: "url('https://transparenttextures.com/patterns/cubes.png')" }}>
            {isLoadingMessages ? (
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg mx-auto w-max text-sm">Loading messages...</div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.senderId === user.id || msg.senderId._id === user.id;
                return (
                  <div key={msg._id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`relative max-w-[85%] md:max-w-[70%] rounded-lg px-3 py-1.5 shadow-sm ${
                      isMe ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-slate-800 dark:text-white rounded-tr-none" 
                           : "bg-white dark:bg-[#202c33] text-slate-800 dark:text-white rounded-tl-none"
                    }`}>
                      {msg.attachments?.map((att, i) => (
                        <div key={i} className="mb-2">
                          {att.fileType === "image" ? (
                            <img src={`${API_BASE}${att.url}`} alt="attachment" className="rounded-md max-h-60 object-contain cursor-pointer" onClick={() => window.open(`${API_BASE}${att.url}`, "_blank")}/>
                          ) : (
                            <a href={`${API_BASE}${att.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/5 rounded-md text-sm hover:underline">
                              <span>📄</span> {att.originalName}
                            </a>
                          )}
                        </div>
                      ))}
                      {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? "text-emerald-700/70 dark:text-emerald-200/50" : "text-slate-500"}`}>
                        <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                        {isMe && renderStatusTicks(msg.status)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {remoteTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-[#202c33] rounded-lg rounded-tl-none px-4 py-2 shadow-sm text-slate-500 text-sm">
                  typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] flex items-end gap-2">
            <label className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>
            
            <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg">
              {attachments.length > 0 && (
                <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="text-red-500 font-bold">&times;</button>
                    </div>
                  ))}
                </div>
              )}
              <textarea 
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message"
                className="w-full bg-transparent p-3 outline-none resize-none max-h-32 text-sm dark:text-white"
                rows="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                style={{ minHeight: '44px' }}
              />
            </div>

            <button 
              onClick={handleSend}
              disabled={!newMessage.trim() && attachments.length === 0}
              className="p-3 bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden sm:flex flex-1 bg-[#f0f2f5] dark:bg-[#222e35] items-center justify-center border-b-[6px] border-brand-500 flex-col gap-6">
          <div className="w-64 h-64 opacity-20">
             <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-800 dark:text-white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z"/></svg>
          </div>
          <h2 className="text-3xl font-light text-slate-600 dark:text-slate-300">Broadcast Private Chat</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm text-center">Secure, end-to-end communication with your team. Select a chat to start messaging.</p>
        </div>
      )}
    </div>
  );
}
