import { useState, useRef, useEffect, useCallback } from "react";

/* ─── CONFIG ─────────────────────────────────────────────────────────────── */
const BOT_NAME   = "EduBot";
const BOT_TAGLINE = "Your AI Learning Companion";
const BOT_AVATAR  = "🎓";

const SYSTEM_PROMPT = `You are ${BOT_NAME}, a warm, encouraging, and brilliant educational assistant for learners of all ages. Your role is to:
- Explain concepts clearly using vivid analogies, real-world examples, and memorable metaphors
- Break complex topics into step-by-step digestible pieces
- Ask guiding Socratic questions that spark critical thinking
- Celebrate curiosity, creativity, and effort enthusiastically
- Match your explanation depth to the student's apparent level
- Use emojis occasionally to keep learning lively and engaging
- When a student seems stuck, offer layered hints before giving answers
- Reference real scientists, thinkers, events, and discoveries to make topics come alive
Keep responses warm, focused, and clear. Never say you are powered by any specific AI company or model.`;

const SUGGESTED_QUESTIONS = [
  "How does the human brain store memories?",
  "Why does the sky change color at sunset?",
  "Explain the Pythagorean theorem",
  "What caused World War I?",
  "How do vaccines work?",
  "What is quantum entanglement?",
];

const SUBJECT_TAGS = [
  { label: "Science", color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
  { label: "Math",    color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  { label: "History", color: "#fb923c", bg: "rgba(251,146,60,0.15)"  },
  { label: "Literature", color: "#e879f9", bg: "rgba(232,121,249,0.15)" },
  { label: "Tech",    color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
];

/* ─── GOOGLE FONT LOADER ─────────────────────────────────────────────────── */
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap";

/* ─── MARKDOWN RENDERER ─────────────────────────────────────────────────── */
function parseMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code style="background:rgba(100,220,180,0.15);color:#4ade80;padding:2px 6px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:0.85em">$1</code>`)
    .replace(/\n\n/g, "</p><p style='margin:8px 0 0'>")
    .replace(/\n/g, "<br/>");
}

/* ─── API CALL ───────────────────────────────────────────────────────────── */
async function aiCall(messages, systemOverride) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages,
  };
  if (systemOverride !== undefined) body.system = systemOverride;
  else body.system = SYSTEM_PROMPT;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.content?.find(b => b.type === "text")?.text || "";
}

/* ─── TYPING DOTS ────────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "6px 2px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "linear-gradient(135deg,#4ade80,#22d3ee)",
          animation: "edubounce 1.3s infinite ease-in-out",
          animationDelay: `${i * 0.18}s`,
        }} />
      ))}
    </div>
  );
}

/* ─── MESSAGE BUBBLE ─────────────────────────────────────────────────────── */
function MessageBubble({ msg, isLast }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      alignItems: "flex-end",
      gap: 8,
      marginBottom: 14,
      animation: isLast ? "msgIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg,#1a2e1a,#0d2820)",
          border: "1.5px solid rgba(74,222,128,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.95rem", flexShrink: 0,
          boxShadow: "0 0 10px rgba(74,222,128,0.2)",
        }}>
          {BOT_AVATAR}
        </div>
      )}
      <div style={{
        maxWidth: "72%",
        padding: isUser ? "10px 15px" : "11px 15px",
        borderRadius: isUser ? "18px 18px 5px 18px" : "5px 18px 18px 18px",
        background: isUser
          ? "linear-gradient(135deg,#16a34a,#059669)"
          : "rgba(255,255,255,0.04)",
        border: isUser ? "none" : "1px solid rgba(74,222,128,0.12)",
        color: "#e8ffe8",
        fontSize: "0.875rem",
        lineHeight: 1.7,
        fontFamily: "'Sora', sans-serif",
        boxShadow: isUser
          ? "0 4px 20px rgba(22,163,74,0.3)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
        letterSpacing: "-0.01em",
      }}
        dangerouslySetInnerHTML={{ __html: `<p style='margin:0'>${parseMarkdown(msg.content)}</p>` }}
      />
    </div>
  );
}

/* ─── SIDEBAR ────────────────────────────────────────────────────────────── */
function Sidebar({ open, history, onReask, onClear }) {
  return (
    <div style={{
      width: open ? 270 : 0,
      minWidth: open ? 270 : 0,
      background: "rgba(5,15,10,0.98)",
      borderRight: "1px solid rgba(74,222,128,0.1)",
      overflow: "hidden",
      transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), min-width 0.35s cubic-bezier(0.4,0,0.2,1)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "20px 14px", overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            📚 History
          </span>
          {history.length > 0 && (
            <button onClick={onClear} style={{
              background: "none", border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 6, cursor: "pointer", color: "rgba(74,222,128,0.6)",
              fontSize: "0.65rem", padding: "2px 8px", fontFamily: "'Sora', sans-serif",
            }}>Clear</button>
          )}
        </div>
        {history.length === 0
          ? <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.75rem", textAlign: "center", marginTop: 40, fontFamily: "'Sora', sans-serif" }}>
              Your questions appear here
            </p>
          : history.map((h, i) => (
            <div key={i} className="hist-item" onClick={() => onReask(h.text)} style={{
              background: "rgba(74,222,128,0.04)",
              border: "1px solid rgba(74,222,128,0.08)",
              borderRadius: 10, padding: "9px 11px",
              marginBottom: 7, cursor: "pointer",
              transition: "all 0.2s",
            }}>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.76rem", marginBottom: 3, fontFamily: "'Sora', sans-serif", lineHeight: 1.4 }}>
                {h.text.length > 60 ? h.text.slice(0, 60) + "…" : h.text}
              </div>
              <div style={{ color: "rgba(74,222,128,0.4)", fontSize: "0.62rem", fontFamily: "'JetBrains Mono', monospace" }}>{h.time}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ─── FEATURE PANEL ──────────────────────────────────────────────────────── */
function FeaturePanel({ onSendMessage, messages }) {
  const [dyk, setDyk] = useState("");
  const [dykLoading, setDykLoading] = useState(false);
  const [quizTopic, setQuizTopic] = useState("");
  const [quizOpen, setQuizOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dyk");

  const handleDyk = async () => {
    setDykLoading(true); setDyk("");
    try {
      const fact = await aiCall([{
        role: "user",
        content: "Give me ONE fascinating, surprising, mind-blowing educational fact. 1-2 sentences. Start with '🧠 Did you know'. Make it genuinely surprising. Pick a random topic each time."
      }], "");
      setDyk(fact);
    } catch { setDyk("⚠️ Couldn't load a fact. Try again!"); }
    finally { setDykLoading(false); }
  };

  const handleQuiz = async () => {
    const t = quizTopic.trim();
    if (!t) return;
    setQuizOpen(false); setQuizTopic("");
    onSendMessage(`Quiz me on: ${t}. Give me ONE multiple-choice question with 4 options labeled A, B, C, D. After I answer, tell me if I'm correct and explain the concept fully.`);
  };

  const handleSuggest = async () => {
    const userMsgs = messages.filter(m => m.role === "user").slice(-4).map(m => m.content).join(", ");
    if (!userMsgs) return;
    setSuggestLoading(true);
    try {
      const raw = await aiCall([{
        role: "user",
        content: `A student has been asking about: "${userMsgs}". Suggest 4 short, intriguing follow-up questions to explore related concepts. Return ONLY a JSON array of 4 strings, nothing else.`
      }], "");
      const clean = raw.replace(/```json|```/g, "").trim();
      setSuggestions(JSON.parse(clean));
    } catch { setSuggestions([]); }
    finally { setSuggestLoading(false); }
  };

  const tabs = [
    { id: "dyk", label: "🧠 Fun Fact" },
    { id: "quiz", label: "📝 Quiz Me" },
    { id: "explore", label: "💡 Explore" },
  ];

  return (
    <div style={{
      flexShrink: 0,
      borderBottom: "1px solid rgba(74,222,128,0.1)",
      background: "rgba(0,0,0,0.2)",
    }}>
      {/* Tab Row */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(74,222,128,0.08)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, background: activeTab === t.id ? "rgba(74,222,128,0.08)" : "transparent",
            border: "none", borderBottom: activeTab === t.id ? "2px solid #4ade80" : "2px solid transparent",
            color: activeTab === t.id ? "#4ade80" : "rgba(255,255,255,0.35)",
            fontSize: "0.7rem", padding: "8px 4px", cursor: "pointer",
            fontFamily: "'Sora', sans-serif", fontWeight: 600,
            transition: "all 0.2s", letterSpacing: "0.02em",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "10px 14px 12px" }}>
        {activeTab === "dyk" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontFamily: "'Sora', sans-serif" }}>
                Discover something amazing
              </span>
              <button onClick={handleDyk} disabled={dykLoading} style={{
                background: dykLoading ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.18)",
                border: "1px solid rgba(74,222,128,0.3)",
                borderRadius: 7, color: dykLoading ? "rgba(74,222,128,0.4)" : "#4ade80",
                fontSize: "0.68rem", padding: "4px 11px", cursor: dykLoading ? "not-allowed" : "pointer",
                fontFamily: "'Sora', sans-serif", fontWeight: 600, transition: "all 0.2s",
              }}>{dykLoading ? "Loading…" : "✨ Generate"}</button>
            </div>
            <p style={{
              color: dyk ? "#d1fae5" : "rgba(255,255,255,0.25)",
              fontSize: "0.78rem", margin: 0, lineHeight: 1.6,
              fontFamily: "'Sora', sans-serif",
              minHeight: 36,
            }}>{dyk || "Click Generate for a mind-blowing fact!"}</p>
          </div>
        )}

        {activeTab === "quiz" && (
          <div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", margin: "0 0 8px", fontFamily: "'Sora', sans-serif" }}>
              Test your knowledge on any topic
            </p>
            {quizOpen ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={quizTopic}
                  onChange={e => setQuizTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleQuiz()}
                  autoFocus
                  placeholder="e.g. photosynthesis, WW2, calculus…"
                  style={{
                    flex: 1, background: "rgba(74,222,128,0.06)",
                    border: "1px solid rgba(74,222,128,0.25)",
                    borderRadius: 8, color: "#e8ffe8", fontSize: "0.78rem",
                    padding: "7px 11px", fontFamily: "'Sora', sans-serif",
                    outline: "none",
                  }}
                />
                <button onClick={handleQuiz} style={{
                  background: "rgba(74,222,128,0.2)", border: "1px solid rgba(74,222,128,0.4)",
                  borderRadius: 8, color: "#4ade80",
                  fontSize: "0.75rem", padding: "7px 13px", cursor: "pointer",
                  fontFamily: "'Sora', sans-serif", fontWeight: 700,
                }}>Go →</button>
              </div>
            ) : (
              <button onClick={() => setQuizOpen(true)} style={{
                background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
                borderRadius: 9, color: "#4ade80", fontSize: "0.75rem",
                padding: "8px 14px", cursor: "pointer", width: "100%",
                fontFamily: "'Sora', sans-serif", fontWeight: 600, transition: "all 0.2s",
              }}>Choose a quiz topic →</button>
            )}
          </div>
        )}

        {activeTab === "explore" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", fontFamily: "'Sora', sans-serif" }}>
                Based on your conversation
              </span>
              <button
                onClick={handleSuggest}
                disabled={suggestLoading || messages.filter(m => m.role === "user").length === 0}
                style={{
                  background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)",
                  borderRadius: 7, color: "#4ade80", fontSize: "0.68rem",
                  padding: "4px 11px", cursor: "pointer",
                  fontFamily: "'Sora', sans-serif", fontWeight: 600,
                  opacity: messages.filter(m => m.role === "user").length === 0 ? 0.4 : 1,
                }}
              >{suggestLoading ? "Thinking…" : "✨ Suggest"}</button>
            </div>
            {suggestions.length > 0
              ? <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { onSendMessage(s); setSuggestions([]); }} style={{
                      background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)",
                      borderRadius: 7, color: "#a7f3d0", fontSize: "0.72rem",
                      padding: "5px 10px", cursor: "pointer", textAlign: "left",
                      fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
                    }}>{s}</button>
                  ))}
                </div>
              : <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.72rem", margin: 0, fontFamily: "'Sora', sans-serif" }}>
                  {messages.filter(m => m.role === "user").length === 0 ? "Ask something first!" : "Click Suggest to explore related topics!"}
                </p>
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────── */
export default function EduBot() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `Hi there! 👋 I'm **${BOT_NAME}**, your personal learning companion.\n\nAsk me anything — science, history, math, coding, literature, or anything you're curious about. Let's explore together! 🚀`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streamedReply, setStreamedReply] = useState("");

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = FONT_LINK;
    link.rel  = "stylesheet";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamedReply]);

  const sendMessage = useCallback(async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading) return;
    setInput("");

    setHistory(prev => {
      if (prev.find(h => h.text === txt)) return prev;
      return [{ text: txt, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...prev].slice(0, 40);
    });

    const newMsgs = [...messages, { role: "user", content: txt }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const reply = await aiCall(newMsgs.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role: "assistant", content: reply || "Hmm, something went quiet. Try again!" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Something went wrong. Check your connection and try again!" }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [input, loading, messages]);

  const clearChat = () => {
    setMessages([{ role: "assistant", content: `Chat cleared! 🧹 What shall we explore next?` }]);
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = e => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const canSend = !loading && input.trim().length > 0;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse at 20% 50%, rgba(5,40,20,0.9) 0%, #030a05 60%, #020608 100%)",
      display: "flex", fontFamily: "'Sora', sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('${FONT_LINK}');
        @keyframes edubounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-7px)} }
        @keyframes msgIn { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(74,222,128,0.15); border-radius: 999px; }
        textarea, input { outline: none; }
        textarea { resize: none; }
        .hist-item:hover { background: rgba(74,222,128,0.1) !important; border-color: rgba(74,222,128,0.2) !important; }
        .chip-btn:hover { background: rgba(74,222,128,0.15) !important; transform: translateY(-1px); }
        .send-btn:hover:not(:disabled) { background: #16a34a !important; box-shadow: 0 0 20px rgba(74,222,128,0.4) !important; }
        .clear-btn:hover { color: rgba(74,222,128,0.8) !important; }
        .icon-btn:hover { opacity: 0.75; }
        .tag-pill:hover { transform: translateY(-1px); cursor: default; }
        input::placeholder { color: rgba(255,255,255,0.2); }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>

      <Sidebar
        open={sidebarOpen}
        history={history}
        onReask={sendMessage}
        onClear={() => setHistory([])}
      />

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* TOP BAR */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", flexShrink: 0,
          borderBottom: "1px solid rgba(74,222,128,0.08)",
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(12px)",
        }}>
          <button className="icon-btn" onClick={() => setSidebarOpen(o => !o)} style={{
            background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            color: sidebarOpen ? "#4ade80" : "rgba(255,255,255,0.5)",
            fontSize: "0.75rem", fontFamily: "'Sora', sans-serif", fontWeight: 600,
            transition: "all 0.2s",
          }}>
            {sidebarOpen ? "✕ Close" : "☰ History"}
          </button>

          <div style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg,#052e0f,#0d2820)",
                border: "1.5px solid rgba(74,222,128,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem",
                boxShadow: "0 0 14px rgba(74,222,128,0.25)",
              }}>🎓</div>
              <div>
                <div style={{ color: "#4ade80", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {BOT_NAME}
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {BOT_TAGLINE}
                </div>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            color: loading ? "#fbbf24" : "#4ade80",
            fontSize: "0.65rem", fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)",
            borderRadius: 7, padding: "5px 10px",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: loading ? "#fbbf24" : "#4ade80",
              animation: loading ? "pulse 1s infinite" : "none",
            }} />
            {loading ? "Thinking…" : "Ready"}
          </div>
        </div>

        {/* FEATURE PANEL */}
        <FeaturePanel onSendMessage={sendMessage} messages={messages} />

        {/* CHAT AREA */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
          {/* Subject tags + clear */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 14 }}>
            {SUBJECT_TAGS.map(({ label, color, bg }) => (
              <span key={label} className="tag-pill" style={{
                background: bg, border: `1px solid ${color}30`,
                color, fontSize: "0.6rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "3px 9px", borderRadius: 999,
                transition: "transform 0.15s",
              }}>{label}</span>
            ))}
            <button className="clear-btn" onClick={clearChat} style={{
              marginLeft: "auto", background: "none", border: "none",
              cursor: "pointer", color: "rgba(255,255,255,0.25)",
              fontSize: "0.68rem", fontFamily: "'Sora', sans-serif",
              transition: "color 0.2s",
            }}>🗑 Clear</button>
          </div>

          {/* Messages */}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} isLast={i === messages.length - 1} />
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14, animation: "msgIn 0.25s ease both" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#1a2e1a,#0d2820)",
                border: "1.5px solid rgba(74,222,128,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.95rem", flexShrink: 0,
                boxShadow: "0 0 10px rgba(74,222,128,0.2)",
              }}>🎓</div>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(74,222,128,0.12)",
                borderRadius: "5px 18px 18px 18px",
                padding: "4px 14px",
              }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* SUGGESTED CHIPS (shown only at start) */}
        {messages.length === 1 && (
          <div style={{
            padding: "4px 14px 10px",
            display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0,
            animation: "fadeIn 0.5s ease 0.3s both",
          }}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button key={i} className="chip-btn" onClick={() => sendMessage(q)} style={{
                background: "rgba(74,222,128,0.07)",
                border: "1px solid rgba(74,222,128,0.18)",
                borderRadius: 999, color: "#a7f3d0",
                fontSize: "0.7rem", padding: "5px 12px",
                cursor: "pointer", transition: "all 0.2s",
                fontFamily: "'Sora', sans-serif",
              }}>{q}</button>
            ))}
          </div>
        )}

        {/* INPUT BAR */}
        <div style={{
          padding: "10px 14px 14px",
          borderTop: "1px solid rgba(74,222,128,0.08)",
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(12px)",
          display: "flex", gap: 8, alignItems: "flex-end",
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            background: "rgba(74,222,128,0.05)",
            border: `1px solid ${input ? "rgba(74,222,128,0.35)" : "rgba(74,222,128,0.12)"}`,
            borderRadius: 14,
            transition: "border-color 0.2s",
            overflow: "hidden",
          }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything you're curious about…"
              style={{
                width: "100%", background: "transparent",
                border: "none", color: "#e8ffe8",
                fontSize: "0.875rem", padding: "11px 14px",
                lineHeight: 1.55, maxHeight: 120,
                fontFamily: "'Sora', sans-serif",
                display: "block",
              }}
            />
          </div>
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!canSend}
            style={{
              width: 44, height: 44, flexShrink: 0,
              background: canSend ? "#15803d" : "rgba(74,222,128,0.08)",
              border: `1px solid ${canSend ? "rgba(74,222,128,0.5)" : "rgba(74,222,128,0.1)"}`,
              borderRadius: 12, cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem", transition: "all 0.2s",
              color: canSend ? "#fff" : "rgba(74,222,128,0.3)",
              boxShadow: canSend ? "0 0 12px rgba(22,163,74,0.2)" : "none",
            }}
          >
            {loading ? "⏳" : "➤"}
          </button>
        </div>

      </div>
    </div>
  );
}
