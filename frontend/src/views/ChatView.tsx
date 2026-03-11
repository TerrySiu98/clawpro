import { useEffect, useRef, useState } from 'react';
import {
  SendMessage,
  StopGeneration,
  ListSessions,
  GetSessionHistory,
  CreateSession,
  SaveMessage,
  RenameSession,
  DeleteSession,
  GetCurrentConfig,
  ListProviderModels,
  SetDefaultModel,
} from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  Send,
  Square,
  Plus,
  MessageSquare,
  Settings,
  Radio,
  ChevronDown,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type SessionItem = {
  id: string;
  title: string;
  updatedAt: string;
  messages: number;
};

type Props = {
  onNavigate: (view: 'settings' | 'channels') => void;
  hidden?: boolean;
};

export default function ChatView({ onNavigate, hidden }: Props) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [models, setModels] = useState<{ id: string; provider: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeSessionRef = useRef<string | null>(null);

  useEffect(() => {
    void loadSessions();
    void loadModels();
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    function persistAssistant(content: string) {
      const sid = activeSessionRef.current;
      if (sid && content) void SaveMessage(sid, 'assistant', content);
    }

    const offToken = EventsOn('chat:token', (text: string) => {
      setStreamBuffer((prev) => prev + text);
    });

    const offDone = EventsOn('chat:done', () => {
      setStreamBuffer((prev) => {
        if (prev) {
          setMessages((msgs) => [...msgs, { role: 'assistant', content: prev }]);
          persistAssistant(prev);
        }
        return '';
      });
      setIsGenerating(false);
    });

    const offError = EventsOn('chat:error', (err: string) => {
      setStreamBuffer((prev) => {
        const content = prev || `错误: ${err}`;
        setMessages((msgs) => [...msgs, { role: 'assistant', content }]);
        persistAssistant(content);
        return '';
      });
      setIsGenerating(false);
    });

    const offStopped = EventsOn('chat:stopped', () => {
      setStreamBuffer((prev) => {
        if (prev) {
          const content = prev + '\n\n[已停止]';
          setMessages((msgs) => [...msgs, { role: 'assistant', content }]);
          persistAssistant(content);
        }
        return '';
      });
      setIsGenerating(false);
    });

    return () => { offToken(); offDone(); offError(); offStopped(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  async function loadSessions() {
    try {
      const list = await ListSessions();
      setSessions(list || []);
    } catch { /* empty */ }
  }

  async function loadModels() {
    try {
      const config = await GetCurrentConfig();
      if (config.defaultModel) {
        setSelectedModel(config.defaultModel);
      }
      if (config.defaultProvider) {
        const modelList = await ListProviderModels(config.defaultProvider);
        setModels(modelList || []);
        if (!config.defaultModel && modelList.length > 0) {
          setSelectedModel(modelList[0].id);
        }
      }
    } catch { /* empty */ }
  }

  async function handleSelectSession(id: string) {
    setActiveSession(id);
    try {
      const history = await GetSessionHistory(id);
      if (history && history.length > 0) {
        setMessages(history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }

  async function handleNewSession() {
    try {
      const result = await CreateSession();
      if (result.success) {
        await loadSessions();
        setMessages([]);
        setActiveSession(result.message);
      }
    } catch { /* empty */ }
  }

  function startRename(session: SessionItem) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || '新对话');
  }

  async function confirmRename(sessionId: string) {
    const title = editingTitle.trim();
    setEditingSessionId(null);
    if (!title) return;
    try {
      const result = await RenameSession(sessionId, title);
      if (result.success) await loadSessions();
    } catch { /* empty */ }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const result = await DeleteSession(sessionId);
      if (result.success) {
        if (activeSession === sessionId) {
          setActiveSession(null);
          setMessages([]);
        }
        await loadSessions();
      }
    } catch { /* empty */ }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isGenerating) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsGenerating(true);
    setStreamBuffer('');

    let sessionId = activeSession;
    if (!sessionId) {
      try {
        const created = await CreateSession();
        if (created.success) {
          sessionId = created.message;
          setActiveSession(sessionId);
          void loadSessions();
        }
      } catch { /* empty */ }
    }

    if (sessionId) {
      void SaveMessage(sessionId, 'user', text).then(() => void loadSessions());
    }

    try {
      const allMessages = [...messages, { role: 'user', content: text }];
      const result = await SendMessage(JSON.stringify(allMessages));
      if (!result.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `发送失败: ${result.error || '未知错误'}` }]);
        setIsGenerating(false);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `发送失败: ${err}` }]);
      setIsGenerating(false);
    }
  }

  async function handleStop() {
    try {
      await StopGeneration();
    } catch { /* empty */ }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className={hidden ? 'hidden' : 'flex flex-1 overflow-hidden'}>
      {/* Sidebar */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200/80 flex flex-col shrink-0">
        <div className="p-3">
          <button
            onClick={() => void handleNewSession()}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition-colors"
          >
            <Plus size={16} />
            新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto compact-scroll px-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-slate-400 text-center mt-8 px-4">
              暂无会话记录。<br />开始第一段对话吧！
            </p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="group">
              {editingSessionId === s.id ? (
                <div className="px-3 py-2">
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void confirmRename(s.id);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    onBlur={() => void confirmRename(s.id)}
                    autoFocus
                    className="w-full bg-white rounded-lg px-2 py-1 text-sm border border-orange-300 outline-none focus:ring-1 focus:ring-orange-200"
                  />
                </div>
              ) : (
                <div
                  onClick={() => void handleSelectSession(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
                    activeSession === s.id
                      ? 'bg-orange-100 text-orange-800 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="shrink-0 opacity-50" />
                    <span className="truncate flex-1 min-w-0">{s.title || '新对话'}</span>
                    <div className="hidden group-hover:flex items-center shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); startRename(s); }}
                        className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDeleteSession(s.id); }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200/80 p-2 space-y-0.5">
          <button
            onClick={() => onNavigate('settings')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Settings size={14} />
            设置
          </button>
          <button
            onClick={() => onNavigate('channels')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Radio size={14} />
            聊天平台
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Model selector bar */}
        <div className="flex items-center px-4 py-2 border-b border-slate-100 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
            >
              <span className="truncate max-w-[200px]">{selectedModel || '选择模型'}</span>
              <ChevronDown size={14} />
            </button>
            {showModelDropdown && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto compact-scroll">
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelDropdown(false);
                      void SetDefaultModel(m.id);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                      selectedModel === m.id ? 'text-orange-600 font-medium bg-orange-50' : 'text-slate-700'
                    }`}
                  >
                    {m.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto compact-scroll px-4 py-6">
          {messages.length === 0 && !streamBuffer && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-3xl mb-4">
                🦞
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">开始对话</h2>
              <p className="text-slate-400 text-sm max-w-sm">
                输入消息开始与 AI 对话。大龙虾基于 OpenClaw 引擎，支持多模型切换和技能扩展。
              </p>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {streamBuffer && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {streamBuffer}
                  <span className="inline-block w-2 h-4 bg-orange-500 ml-0.5 animate-pulse rounded-sm" />
                </div>
              </div>
            )}

            {isGenerating && !streamBuffer && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100 text-slate-500 text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  正在思考...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 p-4 shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                rows={1}
                className="w-full resize-none px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
                style={{ maxHeight: '120px' }}
                disabled={isGenerating}
              />
            </div>
            {isGenerating ? (
              <button
                onClick={() => void handleStop()}
                className="shrink-0 w-11 h-11 rounded-xl bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                title="停止生成"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim()}
                className="shrink-0 w-11 h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:hover:bg-orange-500"
                title="发送"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
