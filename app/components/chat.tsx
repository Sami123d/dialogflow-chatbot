"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Popover from "@radix-ui/react-popover";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Check, Copy, SendHorizonal, Smile, Bot, User } from "lucide-react";

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: number;
  typing?: boolean;
}

type ServerMessage =
  | { type: "bot_response"; text: string }
  | { type: "status"; text: string }
  | { type: "error"; text: string };

const initialMessages: Message[] = [
  {
    sender: "bot",
    text: "Hi there! 👋 How can I help you today?",
    timestamp: Date.now(),
  },
];

function getWebSocketUrl() {
  if (typeof window === "undefined") return "";
  const envUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

  // Prefer explicit env URL in production, fallback to localhost in development.
  if (envUrl) {
    if (envUrl.startsWith("ws://") || envUrl.startsWith("wss://")) {
      return envUrl;
    }

    if (envUrl.startsWith("http://")) {
      return envUrl.replace("http://", "ws://");
    }

    if (envUrl.startsWith("https://")) {
      return envUrl.replace("https://", "wss://");
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${envUrl}`;
  }

  const host = window.location.hostname || "localhost";
  return `ws://${host}:3001`;
}

export default function ChatbotUI() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    const socket = new WebSocket(getWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("Connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage;

        if (data.type === "status") {
          setConnectionStatus(data.text);
          return;
        }

        if (data.type === "bot_response") {
          setMessages((prev) => {
            const updated = prev.filter((message) => !message.typing);
            return [
              ...updated,
              {
                sender: "bot",
                text: data.text,
                timestamp: Date.now(),
              },
            ];
          });
          setLoading(false);
          return;
        }

        if (data.type === "error") {
          setMessages((prev) => [
            ...prev.filter((message) => !message.typing),
            {
              sender: "bot",
              text: `**Error:** ${data.text}`,
              timestamp: Date.now(),
            },
          ]);
          setLoading(false);
        }
      } catch {
        setMessages((prev) => [
          ...prev.filter((message) => !message.typing),
          {
            sender: "bot",
            text: "Unable to parse server response.",
            timestamp: Date.now(),
          },
        ]);
        setLoading(false);
      }
    };

    socket.onerror = () => {
      setConnectionStatus("Connection error");
    };

    socket.onclose = () => {
      setConnectionStatus("Disconnected");
      setLoading(false);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      sender: "user",
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        text: "",
        typing: true,
        timestamp: Date.now(),
      },
    ]);

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev.filter((message) => !message.typing),
        {
          sender: "bot",
          text: "Unable to reach the server. Check your WebSocket connection.",
          timestamp: Date.now(),
        },
      ]);
      setLoading(false);
      return;
    }

    socket.send(
      JSON.stringify({
        type: "user_message",
        text: userMessage.text,
      })
    );
  };

  const copyMessage = (msg: Message, index: number) => {
    navigator.clipboard.writeText(msg.text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Determine status dot color
  const statusColor = 
    connectionStatus === "Connected" ? "bg-emerald-500" : 
    connectionStatus.includes("error") || connectionStatus === "Disconnected" ? "bg-red-500" : 
    "bg-amber-500 animate-pulse";

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md text-white">
            <Bot size={24} />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-slate-900">AI Assistant</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="text-xs text-slate-500 font-medium">{connectionStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport className="h-full p-6">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((msg, index) => {
              const isUser = msg.sender === "user";
              
              return (
                <div
                  key={index}
                  className={`flex gap-3 w-full ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-auto mb-1 shadow-sm ${
                    isUser ? "bg-slate-200 text-slate-600" : "bg-indigo-100 text-indigo-600"
                  }`}>
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`group relative max-w-[75%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm"
                          : "bg-white border border-slate-100 text-slate-700 rounded-bl-sm"
                      }`}
                    >
                      {msg.typing ? (
                        <div className="flex gap-1.5 items-center h-5 px-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.2s]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.4s]" />
                        </div>
                      ) : (
                        <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""}`}>
                          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {msg.text}
                          </Markdown>
                        </div>
                      )}
                    </div>

                    {/* Copy Button (Bot Only) */}
                    {!isUser && !msg.typing && (
                      <button
                        onClick={() => copyMessage(msg, index)}
                        className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                        title="Copy message"
                      >
                        {copiedId === index ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} className="h-2" />
          </div>
        </ScrollArea.Viewport>
      </ScrollArea.Root>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200">
        <div className="max-w-4xl mx-auto flex items-end gap-2 bg-white border border-slate-300 rounded-3xl pl-4 pr-2 py-2 shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 transition-all">
          
          <Popover.Root open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <Popover.Trigger asChild>
              <button className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 rounded-full transition-colors mb-0.5">
                <Smile size={20} />
              </button>
            </Popover.Trigger>
            <Popover.Content className="z-50 mb-2 shadow-2xl rounded-2xl overflow-hidden border-none" sideOffset={8}>
              <EmojiPicker
                theme={Theme.LIGHT}
                onEmojiClick={(e) => setInput((prev) => prev + e.emoji)}
              />
            </Popover.Content>
          </Popover.Root>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 bg-transparent px-2 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 max-h-32"
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || connectionStatus !== "Connected"}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-md disabled:shadow-none mb-0.5"
          >
            <SendHorizonal size={18} className={input.trim() ? "translate-x-0.5" : ""} />
          </button>
        </div>
        
        <div className="text-center mt-3">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            AI generated content may be inaccurate
          </span>
        </div>
      </div>
    </div>
  );
}