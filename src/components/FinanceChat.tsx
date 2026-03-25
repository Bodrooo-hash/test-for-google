import { useState, useRef, useEffect } from "react";
import { Send, Search, Paperclip, Smile, MoreVertical, Phone, Video, Pin, Users, Hash, Check, CheckCheck, ImageIcon, FileText, AtSign } from "lucide-react";

interface User { id: string; name: string; avatar: string; role: string; department: string; online: boolean; lastSeen?: string; }
interface Message { id: string; senderId: string; text: string; time: string; date: string; read: boolean; attachment?: { type: "image" | "file"; name: string; size?: string }; replyTo?: { name: string; text: string }; }
interface Chat { id: string; type: "channel" | "direct" | "group"; name: string; avatar?: string; participants?: string[]; lastMessage: string; lastMessageTime: string; lastMessageSender?: string; unread: number; pinned?: boolean; muted?: boolean; online?: boolean; }

const users: Record<string, User> = {
  me: { id: "me", name: "Ирина Соколова", avatar: "ИС", role: "Глав. бухгалтер", department: "Финансы", online: true },
  u1: { id: "u1", name: "Андрей Козлов", avatar: "АК", role: "Бухгалтер", department: "Финансы", online: true },
  u2: { id: "u2", name: "Мария Волкова", avatar: "МВ", role: "Фин. аналитик", department: "Финансы", online: true },
  u3: { id: "u3", name: "Светлана Белова", avatar: "СБ", role: "Налоговый специалист", department: "Финансы", online: false, lastSeen: "14:30" },
};

const avatarColors: Record<string, string> = { me: "bg-primary", u1: "bg-emerald-500", u2: "bg-violet-500", u3: "bg-amber-500" };
const channelColors: Record<string, string> = { ch1: "bg-primary", ch2: "bg-emerald-500" };

const chats: Chat[] = [
  { id: "ch1", type: "channel", name: "Финансовый отдел", lastMessage: "Ирина: Отчёт по Q4 готов", lastMessageTime: "14:52", unread: 0, pinned: true },
  { id: "d1", type: "direct", name: "Андрей Козлов", lastMessage: "Проверил, всё ок", lastMessageTime: "14:48", unread: 0, online: true },
];

const allMessages: Record<string, Message[]> = {
  ch1: [
    { id: "m1", senderId: "u1", text: "Доброе утро! Загрузил все платёжки за эту неделю.", time: "09:15", date: "27 Фев", read: true },
    { id: "m2", senderId: "me", text: "Отлично, спасибо!", time: "09:22", date: "27 Фев", read: true },
  ],
  d1: [
    { id: "a1", senderId: "u1", text: "Я закончил сверку платежей.", time: "14:20", date: "27 Фев", read: true },
    { id: "a2", senderId: "me", text: "Есть расхождения?", time: "14:25", date: "27 Фев", read: true },
    { id: "a3", senderId: "u1", text: "Проверил, всё ок", time: "14:48", date: "27 Фев", read: true },
  ],
};

const getUserById = (id: string): User | undefined => users[id];
const getChatIcon = (chat: Chat) => { if (chat.type === "channel") return Hash; if (chat.type === "group") return Users; return null; };

export function FinanceChat() {
  const [activeChatId, setActiveChatId] = useState("ch1");
  const [messageInput, setMessageInput] = useState("");
  const [chatMessages, setChatMessages] = useState(allMessages);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "channels" | "direct" | "groups">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChat = chats.find((c) => c.id === activeChatId)!;
  const messages = chatMessages[activeChatId] || [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChatId, messages.length]);

  const sendMessage = () => {
    if (!messageInput.trim()) return;
    const newMsg: Message = { id: `new-${Date.now()}`, senderId: "me", text: messageInput.trim(), time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), date: "27 Фев", read: false };
    setChatMessages((prev) => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), newMsg] }));
    setMessageInput("");
  };

  const filteredChats = chats.filter((c) => {
    const matchesFilter = chatFilter === "all" || (chatFilter === "channels" && c.type === "channel") || (chatFilter === "direct" && c.type === "direct") || (chatFilter === "groups" && c.type === "group");
    const matchesSearch = searchQuery === "" || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getDirectUser = (chat: Chat): User | undefined => chat.type === "direct" ? Object.values(users).find((u) => u.name === chat.name) : undefined;

  return (
    <div className="flex h-[calc(100vh-220px)] bg-card rounded-2xl border border-border overflow-hidden">
      <div className="w-[320px] border-r border-border flex flex-col shrink-0 bg-muted/50">
        <div className="p-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground/85" style={{ fontSize: 16, fontWeight: 600 }}>Сообщения</h3>
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600 }}>{chats.reduce((sum, c) => sum + c.unread, 0)}</span>
          </div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Поиск чатов..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-foreground/[0.04] border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all" style={{ fontSize: 12 }} />
          </div>
          <div className="flex gap-1 bg-foreground/[0.04] rounded-lg p-0.5">
            {([{ key: "all", label: "Все" }, { key: "channels", label: "Каналы" }, { key: "direct", label: "Личные" }, { key: "groups", label: "Группы" }] as const).map((f) => (
              <button key={f.key} onClick={() => setChatFilter(f.key)} className={`flex-1 py-1.5 rounded-md transition-all ${chatFilter === f.key ? "bg-card text-foreground/80 shadow-sm" : "text-muted-foreground hover:text-foreground/55"}`} style={{ fontSize: 11, fontWeight: 500 }}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => {
            const ChatIcon = getChatIcon(chat); const directUser = getDirectUser(chat);
            return (
              <button key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${activeChatId === chat.id ? "bg-primary/[0.08]" : "hover:bg-foreground/[0.03]"}`}>
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${chat.type === "channel" ? channelColors[chat.id] || "bg-primary" : directUser ? avatarColors[directUser.id] || "bg-muted-foreground/40" : "bg-muted-foreground/40"}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    {ChatIcon ? <ChatIcon size={16} /> : directUser ? directUser.avatar : chat.name.slice(0, 2)}
                  </div>
                  {chat.type === "direct" && chat.online && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`truncate ${activeChatId === chat.id ? "text-primary" : "text-foreground/80"}`} style={{ fontSize: 13, fontWeight: chat.unread > 0 ? 600 : 500 }}>{chat.name}</span>
                    <span className={chat.unread > 0 ? "text-primary" : "text-muted-foreground"} style={{ fontSize: 11 }}>{chat.lastMessageTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground truncate" style={{ fontSize: 12 }}>{chat.lastMessage}</span>
                    {chat.unread > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 ml-2 shrink-0" style={{ fontSize: 10, fontWeight: 600, minWidth: 18, textAlign: "center" }}>{chat.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-card">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h4 className="text-foreground/85 truncate" style={{ fontSize: 14, fontWeight: 600 }}>{activeChat.name}</h4>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-2 rounded-xl hover:bg-foreground/[0.04] transition-colors text-muted-foreground"><Phone size={16} /></button>
            <button className="p-2 rounded-xl hover:bg-foreground/[0.04] transition-colors text-muted-foreground"><Video size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-1">
            {messages.map((msg, idx) => {
              const sender = getUserById(msg.senderId); const isMe = msg.senderId === "me";
              const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
              return (
                <div key={msg.id}>
                  {(idx === 0 || messages[idx - 1].date !== msg.date) && (
                    <div className="flex items-center justify-center py-3"><span className="bg-foreground/[0.04] text-muted-foreground px-3 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 500 }}>{msg.date}</span></div>
                  )}
                  <div className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""} ${showAvatar ? "mt-3" : "mt-0.5"}`}>
                    <div className="w-8 shrink-0">{showAvatar && sender && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${avatarColors[sender.id] || "bg-muted-foreground/40"}`} style={{ fontSize: 10, fontWeight: 600 }}>{sender.avatar}</div>
                    )}</div>
                    <div className={`max-w-[70%] min-w-0`}>
                      {showAvatar && !isMe && sender && <p className="text-foreground/50 mb-1 px-1" style={{ fontSize: 11, fontWeight: 600 }}>{sender.name}<span className="text-muted-foreground ml-1.5" style={{ fontWeight: 400 }}>{sender.role}</span></p>}
                      <div className={`px-3.5 py-2 ${isMe ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md" : "bg-foreground/[0.04] text-foreground/80 rounded-2xl rounded-bl-md"}`}>
                        <p style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.text}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span className={isMe ? "text-white/50" : "text-muted-foreground"} style={{ fontSize: 10 }}>{msg.time}</span>
                          {isMe && (msg.read ? <CheckCheck size={12} className="text-white/60" /> : <Check size={12} className="text-white/40" />)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="px-6 py-3.5 border-t border-border shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <div className="flex items-center gap-0.5 shrink-0 pb-1"><button className="p-2 rounded-xl hover:bg-foreground/[0.04] transition-colors text-muted-foreground"><Paperclip size={18} /></button></div>
            <div className="flex-1 relative">
              <textarea value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Написать сообщение..." rows={1}
                className="w-full px-4 py-2.5 rounded-2xl bg-foreground/[0.03] border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 focus:bg-card transition-all resize-none"
                style={{ fontSize: 13, maxHeight: 120 }} />
            </div>
            <div className="flex items-center gap-0.5 shrink-0 pb-1">
              <button className="p-2 rounded-xl hover:bg-foreground/[0.04] transition-colors text-muted-foreground"><Smile size={18} /></button>
              <button onClick={sendMessage} disabled={!messageInput.trim()}
                className={`p-2.5 rounded-xl transition-all ${messageInput.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" : "bg-foreground/[0.04] text-muted-foreground"}`}><Send size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceChat;
