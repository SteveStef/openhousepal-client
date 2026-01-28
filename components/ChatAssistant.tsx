'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2 } from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  message: string
  timestamp: Date
  isTyping?: boolean
}

interface ChatAssistantProps {
  collectionData?: any // This would contain the collection/property data for context
  customerName?: string
}

export default function ChatAssistant({ collectionData, customerName }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      message: `Hi${customerName ? ` ${customerName}` : ''}! I'm your AI property assistant. I can help you with questions about the properties in your collection, compare features, explain neighborhood details, and much more. What would you like to know?`,
      timestamp: new Date()
    }
  ])
  const [isAssistantTyping, setIsAssistantTyping] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!message.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: message.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setMessage('')
    setIsAssistantTyping(true)

    // Simulate AI response delay and typing indicator
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        message: getSimulatedResponse(userMessage.message),
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, assistantMessage])
      setIsAssistantTyping(false)
    }, 1500)
  }

  // Simulate AI responses for demo purposes
  const getSimulatedResponse = (userMsg: string): string => {
    const msg = userMsg.toLowerCase()
    
    if (msg.includes('price') || msg.includes('cost')) {
      return "I can help you understand the pricing! The properties in your collection range from $1.05M to $1.35M. The 456 Oak Avenue property at $1.15M offers great value with recent kitchen renovations, while the 789 Pine Lane at $1.35M is the premium option with 5 bedrooms and 4 baths. Would you like me to compare specific properties or explain what influences these price points?"
    }
    
    if (msg.includes('school') || msg.includes('education')) {
      return "Great question about schools! All properties in your collection are in the highly-rated West Chester Area School District. The elementary schools have ratings of 9/10 or higher, and the high school is known for excellent college prep programs. The 456 Oak Avenue and 321 Elm Street properties are particularly close to the top-rated Fugett Middle School. Would you like specific school ratings or walking distances?"
    }
    
    if (msg.includes('neighborhood') || msg.includes('area')) {
      return "The West Chester area is fantastic! It's known for its historic charm, excellent walkability, and family-friendly atmosphere. The downtown area has great restaurants, shops, and cultural events. All your properties are in safe, well-established neighborhoods with mature trees and sidewalks. The 456 Oak Avenue area is particularly quiet and perfect for families. What specific aspects of the neighborhood interest you most?"
    }
    
    if (msg.includes('compare') || msg.includes('difference')) {
      return "I'd be happy to compare properties for you! Your top two favorites seem to be 456 Oak Avenue ($1.15M, 4 bed/3 bath) and 321 Elm Street ($1.05M, 4 bed/2.5 bath). The Oak Avenue property has an extra half bath and recent kitchen renovations, while Elm Street offers better value and a larger lot. Both have excellent potential. Which specific features would you like me to compare in detail?"
    }
    
    if (msg.includes('commute') || msg.includes('transportation')) {
      return "Commuting from West Chester is very convenient! You're about 25 miles from downtown Philadelphia with easy access via Route 202 and the West Chester Pike. The SEPTA Regional Rail line provides direct service to Center City Philadelphia in about 45 minutes. For those working in the suburbs, King of Prussia and Wilmington are both easily accessible. Would you like specific commute times to any particular area?"
    }
    
    if (msg.includes('investment') || msg.includes('value')) {
      return "West Chester has shown strong property value appreciation over the past decade, with average annual growth of 4-6%. The area's proximity to Philadelphia, excellent schools, and desirable lifestyle make it a solid long-term investment. Properties like yours typically see good resale demand. The recent renovations on 456 Oak Avenue and the larger lot on 321 Elm Street both add to investment potential. Are you considering this as a primary residence or investment property?"
    }
    
    if (msg.includes('size') || msg.includes('space') || msg.includes('square feet')) {
      return "Here's the size breakdown for your collection: 456 Oak Avenue has 4,200 sq ft (perfect for a growing family), 789 Pine Lane is the largest at 5,500 sq ft (great for entertaining), and 321 Elm Street is 3,800 sq ft (cozy but efficient). All properties have good storage and functional layouts. The Oak Avenue property has an excellent flow between kitchen and family room. Would you like details about specific room sizes or layout features?"
    }
    
    if (msg.includes('kitchen') || msg.includes('renovation')) {
      return "The kitchens vary nicely across your collection! 456 Oak Avenue has a recently renovated kitchen with granite countertops and stainless steel appliances - it's absolutely gorgeous and move-in ready. 321 Elm Street has a classic kitchen with good bones that could be updated to your taste. 789 Pine Lane has a spacious kitchen but may benefit from some modernization. Would you like to schedule a viewing to see the Oak Avenue kitchen in person?"
    }
    
    // Default response
    return "That's a great question! I'm here to help you understand everything about your property collection. I can provide details about pricing, neighborhoods, schools, commute times, property features, investment potential, and much more. Feel free to ask me anything specific about the properties you're interested in, or I can help you compare different options. What would be most helpful for your decision-making process?"
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleChat = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setIsMinimized(false)
    }
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleChat}
          className="bg-[#8b7355] hover:bg-[#7a6549] text-white rounded-full p-4 shadow-2xl border border-[#8b7355]/30 hover:scale-105 transition-all duration-300 group"
        >
          <MessageCircle size={24} />
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <div className="absolute -left-2 -top-16 bg-zinc-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap border border-zinc-700">
            Ask me about properties
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900"></div>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`bg-zinc-900/95 border border-zinc-800/60 rounded-2xl shadow-2xl transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#8b7355] rounded-full flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Property Assistant</h3>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400 text-xs">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMinimize}
              className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-zinc-800/50 rounded"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button
              onClick={toggleChat}
              className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-zinc-800/50 rounded"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="h-[440px] overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${
                    msg.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.type === 'user' 
                        ? 'bg-[#8b7355] text-white' 
                        : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      {msg.type === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div>
                      <div className={`rounded-2xl px-4 py-3 ${
                        msg.type === 'user'
                          ? 'bg-[#8b7355] text-white ml-2'
                          : 'bg-zinc-800 text-zinc-100 mr-2'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 px-2">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {isAssistantTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-700 text-zinc-300">
                      <Bot size={14} />
                    </div>
                    <div className="bg-zinc-800 text-zinc-100 rounded-2xl px-4 py-3 mr-2">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800/40">
              <div className="flex items-end space-x-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about properties, neighborhoods, schools..."
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-white placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300 max-h-20"
                    rows={1}
                    style={{ minHeight: '44px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isAssistantTyping}
                  className="bg-[#8b7355] hover:bg-[#7a6549] disabled:bg-zinc-700 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors duration-200 flex items-center justify-center"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-1 text-xs text-zinc-500">
                  <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                  <span>AI powered by property data</span>
                </div>
                <p className="text-xs text-zinc-500">Press Enter to send</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}