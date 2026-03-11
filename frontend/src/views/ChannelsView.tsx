import { useEffect, useState } from 'react';
import {
  ListChannels,
  GetChannelConfigFields,
  InstallChannelPlugin,
  ConfigureChannel,
  RestartGateway,
} from '../../wailsjs/go/main/App';
import {
  ArrowLeft,
  Download,
  Check,
  Loader2,
  Settings,
  ChevronRight,
  X,
} from 'lucide-react';

type Channel = {
  id: string;
  name: string;
  displayName: string;
  installed: boolean;
  configured: boolean;
  running: boolean;
  needsPlugin: boolean;
  pluginName?: string;
};

type ConfigField = {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  required: boolean;
};

type Props = {
  onBack: () => void;
};

const channelIcons: Record<string, string> = {
  qq: '🐧',
  telegram: '✈️',
  feishu: '🪶',
  wecom: '💼',
  discord: '🎮',
  slack: '💬',
  whatsapp: '📱',
  dingtalk: '🔔',
  matrix: '🟩',
  email: '📧',
};

export default function ChannelsView({ onBack }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configFields, setConfigFields] = useState<ConfigField[]>([]);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadChannels();
  }, []);

  async function loadChannels() {
    setLoading(true);
    try {
      const list = await ListChannels();
      setChannels(list || []);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleInstall(pluginName: string, channelId: string) {
    setInstalling(channelId);
    setMessage(null);
    try {
      const result = await InstallChannelPlugin(pluginName);
      if (result.success) {
        setMessage({ type: 'success', text: `${pluginName} 安装成功` });
        await loadChannels();
      } else {
        setMessage({ type: 'error', text: result.error || '安装失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '安装失败' });
    }
    setInstalling(null);
  }

  async function openConfig(channelId: string) {
    setConfigFields([]);
    setConfigValues({});
    setConfiguring(channelId);
    setMessage(null);
    try {
      const fields = await GetChannelConfigFields(channelId);
      setConfigFields(fields || []);
    } catch {
      setConfigFields([]);
    }
  }

  async function handleSaveConfig() {
    if (!configuring) return;
    setSavingConfig(true);
    setMessage(null);
    try {
      const result = await ConfigureChannel(configuring, configValues);
      if (result.success) {
        setMessage({ type: 'success', text: result.message + '，网关已重启' });
        setConfiguring(null);
        await RestartGateway().catch(() => {});
        await loadChannels();
      } else {
        setMessage({ type: 'error', text: result.error || '配置失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '配置失败' });
    }
    setSavingConfig(false);
  }

  return (
    <div className="flex-1 overflow-y-auto compact-scroll bg-slate-50">
      <div className="max-w-2xl mx-auto p-6 lg:p-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          返回聊天
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">聊天平台</h1>
        <p className="text-sm text-slate-500 mb-8">管理 OpenClaw 接入的聊天平台渠道</p>

        {/* Message */}
        {message && (
          <div className={`mb-4 rounded-xl p-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Config modal */}
        {configuring && (
          <div className="mb-6 bg-white rounded-2xl border border-orange-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">
                配置 {channels.find((c) => c.id === configuring)?.displayName}
              </h3>
              <button onClick={() => setConfiguring(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {configFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    value={configValues[field.key] || ''}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => void handleSaveConfig()}
              disabled={savingConfig}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
            >
              {savingConfig ? <><Loader2 size={14} className="animate-spin" /> 保存中...</> : '保存配置'}
            </button>
          </div>
        )}

        {/* Channel cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm hover:border-slate-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                  {channelIcons[ch.id] || '📡'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800">{ch.displayName}</span>
                    {ch.configured && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-bold">
                        已配置
                      </span>
                    )}
                    {ch.needsPlugin && !ch.installed && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-bold">
                        需安装插件
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ch.needsPlugin ? ch.pluginName : '内置支持'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ch.needsPlugin && !ch.installed ? (
                    <button
                      onClick={() => void handleInstall(ch.pluginName ?? '', ch.id)}
                      disabled={installing === ch.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
                    >
                      {installing === ch.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      安装
                    </button>
                  ) : ch.configured ? (
                    <button
                      onClick={() => void openConfig(ch.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <Settings size={12} />
                      修改
                    </button>
                  ) : (
                    <button
                      onClick={() => void openConfig(ch.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
                    >
                      配置
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
