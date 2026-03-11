import { useEffect, useState } from 'react';
import {
  ConfigureProviderWithModel,
  GetCurrentConfig,
  SetDefaultModel,
  SetSystemPrompt,
  CheckForUpdate,
  GetCurrentVersion,
  UpdateOpenClaw,
  RestartGateway,
  RunNativeUninstaller,
  AddModel,
  RemoveModel,
  ListProviderModels,
} from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import {
  ArrowLeft,
  Save,
  ExternalLink,
  Check,
  Loader2,
  Download,
  RefreshCw,
  Trash2,
  Info,
  Plus,
  Star,
  X,
} from 'lucide-react';

type Props = {
  onBack: () => void;
  onUninstalled?: () => void;
};

export default function SettingsView({ onBack, onUninstalled }: Props) {
  const [apiBaseUrl, setApiBaseUrl] = useState('https://oneapi.gs/v1');
  const [apiKey, setApiKey] = useState('');
  const [providerName, setProviderName] = useState('oneapi');
  const [defaultModel, setDefaultModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [maskedKey, setMaskedKey] = useState('');

  const [modelList, setModelList] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [newModelName, setNewModelName] = useState('');
  const [addingModel, setAddingModel] = useState(false);

  const [appVersion, setAppVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; latestVersion: string; releaseURL: string } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updatingEngine, setUpdatingEngine] = useState(false);
  const [engineMsg, setEngineMsg] = useState('');
  const [uninstalling, setUninstalling] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  useEffect(() => {
    void loadConfig();
    void loadVersion();
  }, []);

  async function loadConfig() {
    try {
      const config = await GetCurrentConfig();
      if (config.configured) {
        if (config.apiBaseUrl) setApiBaseUrl(config.apiBaseUrl);
        if (config.defaultProvider) setProviderName(config.defaultProvider);
        if (config.apiKey) setMaskedKey(config.apiKey);
        if (config.defaultModel) setDefaultModel(config.defaultModel);
        if (config.defaultProvider) {
          const models = await ListProviderModels(config.defaultProvider);
          setModelList(models || []);
        }
      }
    } catch { /* empty */ }
  }

  async function loadVersion() {
    try {
      setAppVersion(await GetCurrentVersion());
    } catch { /* empty */ }
  }

  async function loadModels() {
    if (!providerName) return;
    try {
      const models = await ListProviderModels(providerName);
      setModelList(models || []);
    } catch { /* empty */ }
  }

  async function handleSave() {
    if (!apiKey && !maskedKey) {
      setError('请输入 API Key');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      if (apiKey) {
        const result = await ConfigureProviderWithModel(providerName, apiBaseUrl, apiKey, '');
        if (!result.success) {
          setError(result.error || '保存失败');
          setSaving(false);
          return;
        }
      }

      if (systemPrompt) {
        const promptResult = await SetSystemPrompt(systemPrompt);
        if (!promptResult.success) {
          setError(promptResult.error || '设置系统提示词失败');
          setSaving(false);
          return;
        }
      }

      await RestartGateway().catch(() => {});

      setSaved(true);
      if (apiKey) {
        setMaskedKey(apiKey.length > 8 ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4) : '****');
        setApiKey('');
      }
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddModel() {
    const name = newModelName.trim();
    if (!name || !providerName) return;
    setAddingModel(true);
    setError('');
    try {
      const result = await AddModel(providerName, name);
      if (result.success) {
        setNewModelName('');
        await loadModels();
        if (modelList.length === 0) {
          await SetDefaultModel(providerName + '/' + name);
          setDefaultModel(providerName + '/' + name);
        }
      } else {
        setError(result.error || '添加失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    }
    setAddingModel(false);
  }

  async function handleRemoveModel(modelID: string) {
    try {
      const result = await RemoveModel(providerName, modelID);
      if (result.success) {
        await loadModels();
        if (defaultModel === modelID && modelList.length > 1) {
          const remaining = modelList.filter((m) => m.id !== modelID);
          if (remaining.length > 0) {
            await SetDefaultModel(remaining[0].id);
            setDefaultModel(remaining[0].id);
          }
        }
      }
    } catch { /* empty */ }
  }

  async function handleSetDefault(modelID: string) {
    try {
      const result = await SetDefaultModel(modelID);
      if (result.success) {
        setDefaultModel(modelID);
      }
    } catch { /* empty */ }
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    try {
      setUpdateInfo(await CheckForUpdate());
    } catch { /* empty */ }
    setCheckingUpdate(false);
  }

  async function handleUpdateEngine() {
    setUpdatingEngine(true);
    setEngineMsg('');
    try {
      const result = await UpdateOpenClaw();
      setEngineMsg(result.success ? result.message : (result.error || '更新失败'));
      if (result.success) await RestartGateway().catch(() => {});
    } catch (err) {
      setEngineMsg(err instanceof Error ? err.message : '更新失败');
    }
    setUpdatingEngine(false);
  }

  async function doUninstall() {
    setUninstalling(true);
    setConfirmUninstall(false);
    try {
      const result = await RunNativeUninstaller();
      if (result.success) onUninstalled?.();
      else setError(result.error || '卸载失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '卸载失败');
    }
    setUninstalling(false);
  }

  return (
    <div className="flex-1 overflow-y-auto compact-scroll bg-slate-50">
      <div className="max-w-2xl mx-auto p-6 lg:p-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6">
          <ArrowLeft size={16} /> 返回聊天
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">设置</h1>
        <p className="text-sm text-slate-500 mb-8">配置 API 中转服务和模型偏好</p>

        <div className="space-y-6">
          {/* API Config */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">API 中转配置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">供应商名称</label>
                <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="oneapi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
                <p className="text-xs text-slate-400 mt-1">模型 ID 会自动加上此前缀，如 {providerName}/claude-sonnet-4-6</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">API 地址</label>
                <input type="text" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://oneapi.gs/v1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">API Key</label>
                  <button onClick={() => BrowserOpenURL('https://oneapi.gs')} className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">
                    前往获取 Key <ExternalLink size={10} />
                  </button>
                </div>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={maskedKey || 'sk-...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
                {maskedKey && !apiKey && <p className="text-xs text-slate-400 mt-1">当前 Key: {maskedKey}（留空保持不变）</p>}
              </div>
            </div>
          </div>

          {/* Model Management */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">模型管理</h2>

            {/* Add model */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddModel(); }}
                placeholder="输入模型名，如 claude-sonnet-4-6"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
              <button
                onClick={() => void handleAddModel()}
                disabled={!newModelName.trim() || addingModel}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                {addingModel ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                添加
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">自动拼接为 {providerName}/{newModelName || '模型名'}</p>

            {/* Model list */}
            {modelList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无模型，请添加</p>
            ) : (
              <div className="space-y-2">
                {modelList.map((m) => {
                  const isDefault = m.id === defaultModel;
                  return (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isDefault ? 'border-orange-300 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{m.id}</div>
                        <div className="text-xs text-slate-400">{m.name}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isDefault ? (
                          <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">默认</span>
                        ) : (
                          <button
                            onClick={() => void handleSetDefault(m.id)}
                            className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-1"
                          >
                            <Star size={12} /> 设为默认
                          </button>
                        )}
                        <button
                          onClick={() => void handleRemoveModel(m.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* System Prompt */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">其他设置</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">系统提示词（可选）</label>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="你是一个有用的 AI 助手..." rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 resize-none" />
            </div>
          </div>

          {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>}

          <button onClick={() => void handleSave()} disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-60`}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> 保存中...</>
              : saved ? <><Check size={16} /> 已保存，网关已重启</>
              : <><Save size={16} /> 保存配置</>}
          </button>

          {/* Version & Updates */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">版本与更新</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600"><Info size={14} /><span>ClawPro v{appVersion || '...'}</span></div>
                <button onClick={() => void handleCheckUpdate()} disabled={checkingUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 transition-colors">
                  {checkingUpdate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 检查更新
                </button>
              </div>
              {updateInfo && (
                <div className={`rounded-xl p-3 text-sm ${updateInfo.available ? 'bg-orange-50 border border-orange-200 text-orange-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                  {updateInfo.available ? (
                    <div className="flex items-center justify-between">
                      <span>新版本 v{updateInfo.latestVersion} 可用</span>
                      <button onClick={() => BrowserOpenURL(updateInfo.releaseURL)} className="flex items-center gap-1 text-xs font-medium text-orange-600">前往下载 <Download size={10} /></button>
                    </div>
                  ) : <span>已是最新版本</span>}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-600">OpenClaw 引擎</span>
                <button onClick={() => void handleUpdateEngine()} disabled={updatingEngine}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 transition-colors">
                  {updatingEngine ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} 更新引擎
                </button>
              </div>
              {engineMsg && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{engineMsg}</p>}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-rose-700 mb-2">危险操作</h2>
            <p className="text-sm text-slate-500 mb-4">卸载 OpenClaw 引擎。卸载后需要重新安装才能使用。</p>
            {confirmUninstall ? (
              <div className="flex items-center gap-3">
                <button onClick={() => void doUninstall()} disabled={uninstalling}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-colors">
                  {uninstalling ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} 确认卸载
                </button>
                <button onClick={() => setConfirmUninstall(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">取消</button>
              </div>
            ) : (
              <button onClick={() => setConfirmUninstall(true)} disabled={uninstalling}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-60 transition-colors">
                <Trash2 size={14} /> 卸载 OpenClaw 引擎
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
