"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export function AIAssistant() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "System Online. Awaiting input.",
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isOpen])

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue("")

    // Simulate AI response
    setTimeout(() => {
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I am a demo unit. Full cognitive functions are currently offline.",
      }
      setMessages((prev) => [...prev, responseMessage])
    }, 1000)
  }

  // Hide on stream detail pages (e.g., /streams/123) but show on /streams
  if (pathname?.startsWith("/streams/") && pathname !== "/streams") {
    return null
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] h-[600px] flex flex-col bg-white border-2 border-zinc-900 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-zinc-900 bg-zinc-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-900 rounded-none text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 font-orbitron uppercase tracking-wider">Prophecy AI</h3>
                  <p className="text-xs text-zinc-500 flex items-center gap-1 font-mono uppercase">
                    <span className="w-2 h-2 bg-green-500 animate-pulse" />
                    Online
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-zinc-200 transition-colors text-zinc-900 rounded-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    message.role === "user" ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 flex items-center justify-center shrink-0 border-2 border-zinc-900",
                      message.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-900"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "p-3 text-sm leading-relaxed font-mono border-2 border-zinc-900",
                      message.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-900"
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t-2 border-zinc-900 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="ENTER COMMAND..."
                  className="flex-1 bg-zinc-50 border-2 border-zinc-900 px-4 py-2.5 text-sm text-zinc-900 font-mono focus:outline-none focus:bg-white placeholder:text-zinc-400 transition-all rounded-none"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-white border-2 border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-none active:translate-y-0.5"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[49] p-4 bg-zinc-900 text-white border-2 border-transparent hover:border-zinc-900 hover:bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all rounded-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}
