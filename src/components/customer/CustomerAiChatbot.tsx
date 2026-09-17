import { useCallback, useEffect, useRef, useState } from 'react'

type Msg = { id: string; text: string; role: 'user' | 'bot' }

function getMockReply(userText: string): string {
  const m = userText.toLowerCase()
  if (m.includes('bike') && m.includes('under')) {
    return 'Here are bikes under 1 million:\n\n• Yamaha FZ V3 — LKR 780,000\n• Honda CB150R — LKR 890,000\n• Suzuki Gixxer SF — LKR 820,000\n\nWant more detail on one of these?'
  }
  if (m.includes('service') || m.includes('near')) {
    return 'I can help find service centers. Share your city or area and I can point you to nearby trusted shops with ratings.'
  }
  if (m.includes('compare')) {
    return 'Tell me two models to compare — e.g. KTM Duke 200 vs Yamaha FZ V3 — and I will outline the differences.'
  }
  if (m.includes('hello') || m.includes('hi')) {
    return 'Hi! I can help with bike ideas, service booking, and spare parts. What do you need?'
  }
  return `You asked: "${userText}"\n\nI can help with bike search, service booking, and parts. Be a bit more specific and I can narrow it down.`
}

export function CustomerAiChatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: '0',
      role: 'bot',
      text: "Hi! I'm your BikeBuddy AI assistant. How can I help you today? 🏍️",
    },
  ])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, open, typing])

  const send = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: t }])
    setInput('')
    setTyping(true)
    window.setTimeout(() => {
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'bot', text: getMockReply(t) }])
      setTyping(false)
    }, 900)
  }, [])

  return (
    <>
      <button
        type="button"
        className="bbl-cust-chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Open AI assistant"
      >
        <span className="bbl-cust-chat-fab-ico" aria-hidden>
          🤖
        </span>
        <span className="bbl-cust-chat-badge">AI</span>
      </button>
      {open ? (
        <div className="bbl-cust-chat-panel" role="dialog" aria-label="AI assistant">
          <div className="bbl-cust-chat-h">
            <h3>🤖 AI assistant</h3>
            <button
              type="button"
              className="bbl-cust-chat-x"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="bbl-cust-chat-msgs">
            {msgs.map((m) => (
              <div key={m.id} className={`bbl-cust-chat-bubble bbl-cust-chat-bubble--${m.role}`}>
                <div className="bbl-cust-chat-av" aria-hidden>
                  {m.role === 'bot' ? '🤖' : '👤'}
                </div>
                <div className="bbl-cust-chat-txt">
                  {m.text}
                </div>
              </div>
            ))}
            {typing ? <div className="bbl-cust-chat-typing">AI is thinking…</div> : null}
            <div ref={endRef} />
          </div>
          <div className="bbl-cust-chat-foot">
            <div className="bbl-cust-chat-quick">
              <button type="button" onClick={() => send('Bikes under 1M')}>
                Bikes under 1M
              </button>
              <button type="button" onClick={() => send('Service centers near me')}>
                Near me
              </button>
              <button type="button" onClick={() => send('Compare bikes')}>
                Compare
              </button>
            </div>
            <div className="bbl-cust-chat-inrow">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), send(input))}
                placeholder="Ask me anything…"
                aria-label="Message"
              />
              <button
                type="button"
                className="bbl-cust-chat-send"
                disabled={typing}
                onClick={() => send(input)}
                aria-label="Send"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
