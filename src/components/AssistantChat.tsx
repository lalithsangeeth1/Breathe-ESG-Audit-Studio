import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Terminal, 
  Eraser
} from "lucide-react";

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

interface AssistantChatProps {
  tenantId: string;
}

export default function AssistantChat({ tenantId }: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Hello! I am your Breathe ESG Audit Assistant. I am directly connected to your tenant's active database state, facility codes, and emission factor arrays.\n\nType down queries like **'Summarize my active carbon anomalies'**, **'Verify Munich Foundry grid multipliers'**, or **'Explain how flight coordinates are geodesic'** to begin."
    }
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto Scroll down
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || inputText;
    if (!textToSend.trim()) return;

    // Append user message
    setMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
    if (!customMessage) setInputText("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          message: textToSend
        })
      });

      const data = await response.json();
      if (response.ok && data.text) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: "Exception responding to chat stream: Check system API connections." }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'bot', text: `Network connection exception: ${err.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadPresetQuery = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const clearChatHistory = () => {
    setMessages([
      {
        sender: 'bot',
        text: "Log history cleared. Ask Breathe ESG Auditor Buddy any operational compliance questions!"
      }
    ]);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col h-[65vh] overflow-hidden">
      
      {/* Chat Terminal Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 bgColor bg-indigo-650 text-emerald-300 rounded">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs leading-none">
              Breathe ESG Auditor Copilot
            </h4>
            <p className="text-[9px] text-slate-400 mt-1 font-mono">Real-time dynamic compliance dialogue</p>
          </div>
        </div>

        <button 
          onClick={clearChatHistory}
          className="text-slate-400 hover:text-slate-900 p-1 hover:bg-slate-100 rounded transition text-[10px] font-mono flex items-center gap-1 cursor-pointer"
        >
          <Eraser className="w-3 h-3" /> Clear Console
        </button>
      </div>

      {/* Suggest questions help triggers panel */}
      <div className="bg-gradient-to-r from-indigo-50/20 to-slate-50/40 p-2 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-mono uppercase text-[#64748b] font-black select-none">Suggested Queries:</span>
        <button 
          onClick={() => loadPresetQuery("List all active carbon anomalies and explain their risks")}
          className="bg-white border border-slate-200 text-slate-655 text-[10px] py-0.5 px-2 rounded hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer select-none font-medium"
        >
          Anomalies report
        </button>
        <button 
          onClick={() => loadPresetQuery("How does Munich Foundry compute grid electricity using German grid coefficients?")}
          className="bg-white border border-slate-200 text-slate-655 text-[10px] py-0.5 px-2 rounded hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer select-none font-medium"
        >
          Munich Elec coefficients
        </button>
        <button 
          onClick={() => loadPresetQuery("Explain why airline tickets segments like SFO-LHR are geodesic and use seat multipliers")}
          className="bg-white border border-slate-200 text-slate-655 text-[10px] py-0.5 px-2 rounded hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer select-none font-medium"
        >
          Great-circle geodesics
        </button>
      </div>

      {/* Messages Scroll Layout */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/20">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex items-start gap-2.5 max-w-[85%] ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {/* Sender Icons */}
            <div className={`p-1 rounded shrink-0 ${
              msg.sender === 'user' ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-indigo-750'
            }`}>
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-indigo-600" />}
            </div>

            {/* Message Body bubble */}
            <div className={`p-2.5 rounded-lg text-xs leading-relaxed font-sans whitespace-pre-wrap ${
              msg.sender === 'user' 
                ? 'bg-slate-900 text-slate-100 rounded-tr-none shadow-3xs' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-3xs'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Loading Bubble */}
        {isGenerating && (
          <div className="flex items-start gap-2.5 max-w-[85%]">
            <div className="p-1 bg-slate-100 text-indigo-600 rounded shrink-0">
              <Bot className="w-3.5 h-3.5 animate-bounce" />
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-400 font-mono flex items-center gap-1.5 shadow-3xs leading-none">
              <Terminal className="w-3.5 h-3.5 animate-pulse text-indigo-500" /> Calculating compliant recommendations...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Chat Input Text controllers */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Query corporate emissions files or request guidance..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isGenerating}
            className="flex-1 bg-white border border-slate-200 text-slate-850 text-xs rounded-lg p-2 pl-3 hover:border-slate-350 focus:outline-none focus:ring-1 focus:ring-slate-900 outline-none transition"
          />
          <button
            type="submit"
            disabled={isGenerating || !inputText.trim()}
            className="p-2 bg-indigo-650 hover:bg-indigo-700 hover:text-white text-emerald-100 rounded-lg transition disabled:opacity-40 cursor-pointer text-xs flex items-center justify-center min-w-[36px]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
