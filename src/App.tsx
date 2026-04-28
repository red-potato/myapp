
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Smile, 
  MoreHorizontal, 
  ChevronLeft, 
  Info, 
  Image as ImageIcon,
  Heart,
  ThumbsUp,
  Laugh,
  Angry,
  Sparkles,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { Message } from './types';
import { chatWithMaya, generateMayaImage } from './services/gemini';
import { chatStorage } from './lib/storage';
import { cn } from './lib/utils';
import { useNotifications } from './hooks/useNotifications';

// --- Components ---

const ReactionPicker = ({ onSelect }: { onSelect: (reaction: string) => void }) => {
  const reactions = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0, y: 10 }}
      className="absolute -top-12 left-0 flex bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-gray-100 p-1 gap-1 z-50"
    >
      {reactions.map(r => (
        <button 
          key={r} 
          onClick={() => onSelect(r)}
          className="hover:scale-125 transition-transform p-1 text-lg"
        >
          {r}
        </button>
      ))}
    </motion.div>
  );
};

const MessageBubble = ({ 
  message, 
  isLast, 
  onReact 
}: { 
  message: Message; 
  isLast: boolean;
  onReact: (id: string, reaction: string) => void;
}) => {
  const isUser = message.role === 'user';
  const [showReactions, setShowReactions] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex flex-col mb-4 max-w-[80%]",
        isUser ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div className="relative group">
        <div 
          onClick={() => !isUser && setShowReactions(!showReactions)}
          className={cn(
            "relative px-4 py-2.5 rounded-2xl shadow-sm text-[15px] cursor-pointer",
            isUser 
              ? "bg-[#0084FF] text-white rounded-tr-none" 
              : "bg-gray-100 text-gray-800 rounded-tl-none hover:bg-gray-200 transition-colors"
          )}
        >
          {message.type === 'image' && message.metadata?.imageUrl ? (
            <div className="flex flex-col gap-2">
              <img 
                src={message.metadata.imageUrl} 
                alt="Maya's creation" 
                className="rounded-lg max-w-full h-auto"
                referrerPolicy="no-referrer"
              />
              <p className="text-sm italic">{message.content}</p>
            </div>
          ) : (
            <p className="leading-relaxed">{message.content}</p>
          )}
          
          <AnimatePresence>
            {showReactions && !isUser && (
              <div className="absolute left-0 bottom-full mb-2">
                <ReactionPicker onSelect={(r) => {
                  onReact(message.id, r);
                  setShowReactions(false);
                }} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div className={cn(
            "absolute -bottom-3 flex gap-0.5 bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-gray-100",
            isUser ? "right-2" : "left-2"
          )}>
            {message.reactions.map((r, i) => (
              <span key={i} className="text-[10px]">{r}</span>
            ))}
          </div>
        )}
      </div>
      
      <span className="text-[10px] text-gray-400 mt-1.5 px-1 font-medium">
        {format(message.timestamp, 'p')}
      </span>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { permission, showNotification } = useNotifications();

  useEffect(() => {
    const saved = chatStorage.getMessages();
    if (saved.length > 0) {
      setMessages(saved);
    } else {
      const welcome: Message = {
        id: 'welcome',
        role: 'assistant',
        content: 'Hey! Ami Maya. Ki obostha tomar? Onekdin por kotha hocche!',
        timestamp: Date.now(),
      };
      setMessages([welcome]);
      chatStorage.saveMessages([welcome]);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);
    chatStorage.saveMessages(newMessages);

    try {
      const responseText = await chatWithMaya(messages, input.trim());
      
      const imageMatch = responseText.match(/\[IMAGE_PROMPT: (.*?)\]/);
      let assistantMsg: Message;

      if (imageMatch) {
         const prompt = imageMatch[1];
         const cleanText = responseText.replace(/\[IMAGE_PROMPT: .*?\]/, '').trim();
         
         assistantMsg = {
           id: (Date.now() + 1).toString(),
           role: 'assistant',
           content: cleanText || "Dekho ki banailam!",
           timestamp: Date.now(),
           type: 'image',
           metadata: { prompt }
         };

         setMessages(prev => [...prev, assistantMsg]);
         
         const imageUrl = await generateMayaImage(prompt);
         if (imageUrl) {
           setMessages(prev => prev.map(m => 
             m.id === assistantMsg.id ? { ...m, metadata: { ...m.metadata, imageUrl } } : m
           ));
           chatStorage.saveMessages([...newMessages, { ...assistantMsg, metadata: { ...assistantMsg.metadata, imageUrl } }]);
         }
      } else {
        assistantMsg = {
          id: Date.now().toString(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        chatStorage.saveMessages([...newMessages, assistantMsg]);
      }

      showNotification('Maya sent a message', { body: assistantMsg.content });

    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReact = (id: string, reaction: string) => {
    const updated = messages.map(m => 
      m.id === id ? { ...m, reactions: [...(m.reactions || []), reaction].slice(-3) } : m
    );
    setMessages(updated);
    chatStorage.saveMessages(updated);
  };

  const clearChat = () => {
    if (confirm('Sob chat muche felbe?')) {
      chatStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-[#E5E5E5] font-sans overflow-hidden">
      {/* Sidebar - Visible on Desktop */}
      <aside className="hidden lg:flex w-80 bg-[#121212] border-r border-[#262626] flex-col">
        <div className="p-8 flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-2 border-[#3D3D3D] p-1">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-pink-500/20">
                M
              </div>
            </div>
            <div className="absolute bottom-1 right-2 w-6 h-6 bg-green-500 border-4 border-[#121212] rounded-full"></div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Maya</h2>
            <p className="text-sm text-[#888888] font-medium">Online now • Dhaka, BD</p>
          </div>
        </div>

        <div className="px-6 space-y-6">
          <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#262626]">
            <p className="text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-bold">Persona</p>
            <p className="text-sm text-[#BBBBBB] leading-relaxed">
              I'm your virtual Bondhu. Kotha bolte bhalo lage, r Banglish e chill kori. 
              No pics sharing for privacy, but image generate kore dite pari! ✨
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm p-3 bg-[#1A1A1A] rounded-xl border border-[#262626] opacity-70">
              <span className="text-[#888888]">Privacy Mode</span>
              <span className="text-green-500 text-xs font-bold uppercase">Active</span>
            </div>
            <div className="flex items-center justify-between text-sm p-3 bg-[#1A1A1A] rounded-xl border border-[#262626] opacity-70">
              <span className="text-[#888888]">Notifications</span>
              <span className={cn("text-xs font-bold uppercase", permission === 'granted' ? "text-blue-400" : "text-[#555555]")}>
                {permission === 'granted' ? 'Enabled' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto p-6">
          <button 
            onClick={clearChat}
            className="w-full py-3 bg-[#222222] hover:bg-[#2A2A2A] rounded-xl text-xs font-bold tracking-widest text-[#AAAAAA] transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> CLEAR CHAT
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0F0F0F] relative max-w-4xl mx-auto lg:max-w-none">
        {/* Chat Header */}
        <header className="h-20 border-b border-[#262626] flex items-center justify-between px-6 lg:px-8 bg-[#0F0F0F]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            <div className="lg:hidden flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 p-0.5">
                  <div className="w-full h-full rounded-full bg-[#121212] overflow-hidden flex items-center justify-center text-xs font-bold">M</div>
               </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <div className={cn("w-2 h-2 rounded-full", isTyping ? "bg-blue-400 animate-pulse" : "bg-green-500")}></div>
                <span className="text-sm font-medium tracking-wide">
                  {isTyping ? "Maya is typing..." : "Maya is online"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2 lg:space-x-4">
            <button className="p-2 hover:bg-[#1A1A1A] rounded-full text-[#888888]">
              <Smile className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-[#1A1A1A] rounded-full text-[#888888]">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Message Viewport */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 scrollbar-hide">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={cn(
                  "flex flex-col space-y-2 max-w-[85%] lg:max-w-[70%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className="flex flex-col relative group">
                  <div 
                    className={cn(
                      "p-4 rounded-2xl text-[14px] leading-relaxed shadow-sm transition-all",
                      msg.role === 'user' 
                        ? "bg-white text-black rounded-br-none font-medium" 
                        : "bg-[#1A1A1A] text-[#E5E5E5] rounded-bl-none border border-[#2D2D2D] hover:border-[#3D3D3D]"
                    )}
                  >
                    {msg.type === 'image' && msg.metadata?.imageUrl ? (
                      <div className="flex flex-col gap-3">
                        <img 
                          src={msg.metadata.imageUrl} 
                          alt="Maya's art" 
                          className="rounded-xl max-w-full h-auto brightness-90 hover:brightness-100 transition-all"
                          referrerPolicy="no-referrer"
                        />
                        <p className="text-sm italic text-[#BBBBBB]">{msg.content}</p>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  
                  {/* Reactions */}
                  {msg.role === 'assistant' && (
                    <div className="flex space-x-1 mt-2 pl-1">
                      {['❤️', '🔥', '😂'].map(emoji => (
                        <button 
                          key={emoji}
                          onClick={() => handleReact(msg.id, emoji)}
                          className={cn(
                            "hover:scale-125 transition-transform text-xs p-1 rounded-full",
                            msg.reactions?.includes(emoji) ? "bg-[#252525]" : ""
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={cn("flex space-x-2", msg.role === 'user' ? "pr-1" : "pl-1")}>
                  <span className="px-2 py-1 bg-[#121212] rounded-full text-[10px] text-[#555555] font-bold uppercase tracking-wider">
                    {msg.role === 'user' ? 'Delivered' : format(msg.timestamp, 'p')}
                  </span>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center space-x-2 text-[#555555] pl-1"
              >
                <div className="flex space-x-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-[#333333] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Maya thinking...</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 border-t border-[#262626] bg-[#0F0F0F]">
          <div className="flex items-center space-x-3 bg-[#1A1A1A] p-1.5 lg:p-2 rounded-2xl border border-[#2D2D2D] shadow-inner">
            <button className="p-3 text-[#555555] hover:text-[#E5E5E5] transition-colors hidden sm:block">
              <ImageIcon className="w-6 h-6" />
            </button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Write in Banglish..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-2 text-white placeholder-[#444444]"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={cn(
                "p-2.5 rounded-xl transition-all shadow-lg",
                input.trim() && !isTyping 
                  ? "bg-white text-black hover:bg-[#E5E5E5]" 
                  : "bg-[#222222] text-[#444444]"
              )}
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
          <p className="text-[9px] lg:text-[10px] text-center mt-3 text-[#444444] tracking-[0.2em] font-bold uppercase">
            No media storage • End-to-end Encrypted • Native PWA
          </p>
        </div>
      </div>
    </div>
  );
}
