import { useEffect, useState } from 'react';
import './App.css';
import {
  GetBootstrapPayload,
  IsOpenClawInstalled,
  IsOpenClawConfigured,
  EnsureGatewayRunning,
  ResizeToChat,
} from '../wailsjs/go/main/App';
import WindowChrome from './components/WindowChrome';
import ChatView from './views/ChatView';
import SettingsView from './views/SettingsView';
import ChannelsView from './views/ChannelsView';
import SetupView from './views/SetupView';

type AppView = 'loading' | 'setup' | 'chat' | 'settings' | 'channels';

export default function App() {
  const [view, setView] = useState<AppView>('loading');
  const [platform, setPlatform] = useState('');
  const [architecture, setArchitecture] = useState('');
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const payload = await GetBootstrapPayload();
      setPlatform(payload.environment.platform);
      setArchitecture(payload.environment.architecture);
      setHostname(payload.environment.hostname);

      const installed = await IsOpenClawInstalled();
      if (!installed) {
        setView('setup');
        return;
      }

      const configured = await IsOpenClawConfigured();
      if (!configured) {
        setView('setup');
        return;
      }

      try {
        await EnsureGatewayRunning();
      } catch { /* non-critical */ }

      await ResizeToChat();
      setView('chat');
    } catch {
      setView('setup');
    }
  }

  async function handleSetupComplete() {
    await ResizeToChat();
    setView('chat');
  }

  return (
    <main className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden">
      <WindowChrome />

      {view === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-500">
            <div className="w-10 h-10 border-4 border-slate-300 border-t-orange-500 rounded-full animate-spin" />
            <p className="font-medium tracking-wider text-sm">正在启动...</p>
          </div>
        </div>
      )}

      {view === 'setup' && (
        <SetupView
          platform={platform}
          architecture={architecture}
          hostname={hostname}
          onSetupComplete={handleSetupComplete}
        />
      )}

      <ChatView onNavigate={(v) => setView(v)} hidden={view !== 'chat'} />

      {view === 'settings' && (
        <SettingsView onBack={() => setView('chat')} onUninstalled={() => setView('setup')} />
      )}

      {view === 'channels' && (
        <ChannelsView onBack={() => setView('chat')} />
      )}
    </main>
  );
}
