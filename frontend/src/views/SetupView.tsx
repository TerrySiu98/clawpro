import { useEffect, useState } from 'react';
import {
  IsOpenClawInstalled,
  RunNativeInstaller,
  ConfigureProviderWithModel,
  EnsureGatewayRunning,
} from '../../wailsjs/go/main/App';
import {
  EventsOn,
  BrowserOpenURL,
} from '../../wailsjs/runtime/runtime';
import { ExternalLink, Loader2, ArrowRight, Check } from 'lucide-react';

type InstallerStepUpdate = {
  step: string;
  status: string;
  message: string;
};

type Props = {
  platform: string;
  architecture: string;
  hostname: string;
  onSetupComplete: () => void;
};

type SetupPhase = 'welcome' | 'installing' | 'install-failed' | 'configure-key' | 'starting' | 'done';

export default function SetupView({ platform, architecture, hostname, onSetupComplete }: Props) {
  const [phase, setPhase] = useState<SetupPhase>('welcome');
  const [installerSteps, setInstallerSteps] = useState<InstallerStepUpdate[]>([]);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://oneapi.gs/v1');
  const [providerName, setProviderName] = useState('oneapi');
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-6');
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    const unsub = EventsOn('installer:step', (update: InstallerStepUpdate) => {
      setInstallerSteps((prev) => [...prev, update]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    void checkExistingInstall();
  }, []);

  async function checkExistingInstall() {
    try {
      const installed = await IsOpenClawInstalled();
      if (installed) {
        setPhase('configure-key');
      }
    } catch { /* empty */ }
  }

  async function startInstall() {
    setPhase('installing');
    setError('');
    setInstallerSteps([]);

    try {
      const result = await RunNativeInstaller({
        tag: 'latest',
        installMethod: 'npm',
        noOnboard: true,
        noGitUpdate: false,
        dryRun: false,
        useCnMirrors: true,
        npmRegistry: '',
        installBaseUrl: '',
        repoUrl: '',
        gitDir: '',
      });

      if (result.success) {
        setPhase('configure-key');
      } else {
        setError(result.error || '安装失败');
        setPhase('install-failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装失败');
      setPhase('install-failed');
    }
  }

  async function saveKeyAndContinue() {
    if (!apiKey.trim()) {
      onSetupComplete();
      return;
    }

    setSavingKey(true);
    try {
      const result = await ConfigureProviderWithModel(providerName, apiBaseUrl, apiKey, defaultModel);
      if (!result.success) {
        setError(result.error || 'API Key 配置失败');
        setSavingKey(false);
        return;
      }

      setPhase('starting');
      const gwResult = await EnsureGatewayRunning();
      if (!gwResult.success) {
        console.warn('Gateway start warning:', gwResult.error);
      }

      onSetupComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '配置失败');
    } finally {
      setSavingKey(false);
    }
  }

  function skipKeyConfig() {
    onSetupComplete();
  }

  const installPhases = [
    { id: 'node', label: '检测运行环境', icon: '⬡', desc: '检查 Node.js 版本' },
    { id: 'npm-install', label: '安装核心组件', icon: '⚙', desc: '通过 npm 安装 OpenClaw' },
    { id: 'path', label: '配置系统路径', icon: '⛓', desc: '确保命令行可用' },
    { id: 'gateway', label: '初始化服务', icon: '◈', desc: '配置后台服务' },
    { id: 'done', label: '完成安装', icon: '✦', desc: '验证安装结果' },
  ];

  const stepMapping: Record<string, string> = {
    'init': 'node', 'node': 'node', 'node-install': 'node',
    'detect': 'npm-install', 'npm-install': 'npm-install', 'git-install': 'npm-install', 'git-check': 'npm-install',
    'path': 'path',
    'gateway': 'gateway', 'doctor': 'gateway', 'onboard': 'gateway', 'setup': 'gateway',
    'done': 'done',
  };

  const currentStep = installerSteps.length > 0 ? installerSteps[installerSteps.length - 1] : null;
  const phaseOrder = installPhases.map((p) => p.id);
  const activePhaseIdx = currentStep
    ? (() => {
        const mapped = stepMapping[currentStep.step] || currentStep.step;
        const idx = phaseOrder.indexOf(mapped);
        return idx >= 0 ? idx : 0;
      })()
    : 0;

  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
      <div className="max-w-lg w-full">

        {/* Welcome */}
        {phase === 'welcome' && (
          <div className="flex flex-col items-center text-center animate-fade-in-up">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-5xl shadow-xl mb-8">
              🦞
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-3">
              欢迎使用{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">
                大龙虾
              </span>
            </h1>
            <p className="text-slate-500 text-base leading-relaxed font-medium mb-6">
              基于 OpenClaw 的中文 AI 智能体客户端。<br />
              点击下方按钮开始自动安装 OpenClaw 引擎。
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
                {platform} · {architecture}
              </span>
              <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
                {hostname}
              </span>
            </div>

            <button
              onClick={() => void startInstall()}
              className="px-10 py-4 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-xl shadow-orange-500/25 transition-all hover:-translate-y-1 active:translate-y-0"
            >
              开始一键安装
            </button>
            <p className="text-xs text-slate-400 mt-3">安装过程完全自动，通常需要 1-3 分钟</p>
          </div>
        )}

        {/* Installing */}
        {phase === 'installing' && (
          <div className="flex flex-col items-center animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-3xl shadow-lg shimmer-active mb-6">
              🦞
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">正在安装 OpenClaw</h2>
            <p className="text-sm text-slate-500 mb-8">请稍候，安装程序正在配置您的环境</p>

            <div className="w-full space-y-3">
              {installPhases.map((p, idx) => {
                const isDone = idx < activePhaseIdx || (idx === activePhaseIdx && currentStep?.status === 'ok' && p.id === 'done');
                const isActive = idx === activePhaseIdx && !isDone;
                const isError = isActive && currentStep?.status === 'error';

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${
                      isActive
                        ? 'bg-orange-50/80 border-orange-200 shadow-sm'
                        : isDone
                        ? 'bg-emerald-50/50 border-emerald-100'
                        : 'bg-slate-50/50 border-slate-100'
                    } ${isError ? '!bg-rose-50/80 !border-rose-200' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all duration-500 ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? isError ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}>
                      {isDone ? '✓' : isActive ? (isError ? '✗' : <span className="progress-spinner inline-block">⟳</span>) : p.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold transition-colors ${isDone ? 'text-emerald-700' : isActive ? (isError ? 'text-rose-700' : 'text-slate-800') : 'text-slate-400'}`}>
                        {p.label}
                      </div>
                      <div className={`text-xs mt-0.5 truncate ${isDone ? 'text-emerald-600/70' : isActive ? (isError ? 'text-rose-500' : 'text-slate-500') : 'text-slate-300'}`}>
                        {isActive && currentStep ? currentStep.message : isDone ? '已完成' : p.desc}
                      </div>
                    </div>
                    {isActive && !isError && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Install failed */}
        {phase === 'install-failed' && (
          <div className="flex flex-col items-center text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-4xl shadow-lg mb-6">
              ✗
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">安装遇到问题</h2>
            {error && (
              <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 text-left text-sm text-rose-700 font-mono break-all whitespace-pre-wrap">
                {error}
              </div>
            )}
            <button
              onClick={() => void startInstall()}
              className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg transition-all"
            >
              重试安装
            </button>
          </div>
        )}

        {/* Configure API Key */}
        {phase === 'configure-key' && (
          <div className="flex flex-col items-center animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white text-3xl shadow-lg mb-6">
              <Check size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">配置 API 中转</h2>
            <p className="text-sm text-slate-500 mb-6 text-center">
              输入 API Key 以连接大模型服务。<br />
              推荐使用 <button onClick={() => BrowserOpenURL('https://oneapi.gs')} className="text-orange-500 hover:underline inline-flex items-center gap-0.5">oneapi.gs <ExternalLink size={10} /></button> 获取。
            </p>

            <div className="w-full space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">供应商名称</label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="oneapi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">API 地址</label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">默认模型</label>
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="claude-sonnet-4-6"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
                <p className="text-xs text-slate-400 mt-1">只需填模型名，会自动拼接为 {providerName}/{defaultModel || '模型名'}</p>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <button
              onClick={() => void saveKeyAndContinue()}
              disabled={savingKey}
              className="w-full py-3 rounded-xl font-medium text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {savingKey ? (
                <><Loader2 size={16} className="animate-spin" /> 配置中...</>
              ) : apiKey.trim() ? (
                <>保存并进入 <ArrowRight size={16} /></>
              ) : (
                <>跳过，稍后配置 <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        )}

        {/* Starting gateway */}
        {phase === 'starting' && (
          <div className="flex flex-col items-center text-center animate-fade-in-up">
            <Loader2 size={40} className="animate-spin text-orange-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">正在启动...</h2>
            <p className="text-sm text-slate-500 mt-2">正在启动 OpenClaw Gateway</p>
          </div>
        )}
      </div>
    </div>
  );
}
