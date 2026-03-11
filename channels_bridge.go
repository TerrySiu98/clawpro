package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type ChannelInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Installed   bool   `json:"installed"`
	Configured  bool   `json:"configured"`
	Running     bool   `json:"running"`
	NeedsPlugin bool   `json:"needsPlugin"`
	PluginName  string `json:"pluginName,omitempty"`
}

type ChannelConfigField struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Placeholder string `json:"placeholder"`
	Secret      bool   `json:"secret"`
	Required    bool   `json:"required"`
}

func (a *App) ListChannels() []ChannelInfo {
	channels := getKnownChannels()

	out, err := execOutput("openclaw", "plugins", "list", "--json")
	if err == nil {
		var installed []string
		if json.Unmarshal([]byte(strings.TrimSpace(out)), &installed) == nil {
			pluginSet := make(map[string]bool)
			for _, p := range installed {
				pluginSet[p] = true
			}
			for i := range channels {
				if channels[i].NeedsPlugin && channels[i].PluginName != "" {
					channels[i].Installed = pluginSet[channels[i].PluginName]
				}
			}
		}
	}

	configSnap := a.readRawConfig()
	if chans, ok := configSnap["channels"].(map[string]interface{}); ok {
		for i := range channels {
			if ch, ok := chans[channels[i].ID].(map[string]interface{}); ok {
				if enabled, ok := ch["enabled"].(bool); ok && enabled {
					channels[i].Configured = true
				} else if enabledStr, ok := ch["enabled"].(string); ok && enabledStr == "true" {
					channels[i].Configured = true
				}
			}
		}
	}

	return channels
}

func getKnownChannels() []ChannelInfo {
	return []ChannelInfo{
		{ID: "qq", Name: "qq", DisplayName: "QQ", Installed: true, NeedsPlugin: false},
		{ID: "telegram", Name: "telegram", DisplayName: "Telegram", Installed: true, NeedsPlugin: false},
		{ID: "feishu", Name: "feishu", DisplayName: "飞书", Installed: true, NeedsPlugin: false},
		{ID: "wecom", Name: "wecom", DisplayName: "企业微信", NeedsPlugin: true, PluginName: "@openclaw/wecom"},
		{ID: "discord", Name: "discord", DisplayName: "Discord", Installed: true, NeedsPlugin: false},
		{ID: "slack", Name: "slack", DisplayName: "Slack", Installed: true, NeedsPlugin: false},
		{ID: "whatsapp", Name: "whatsapp", DisplayName: "WhatsApp", Installed: true, NeedsPlugin: false},
		{ID: "dingtalk", Name: "dingtalk", DisplayName: "钉钉", NeedsPlugin: true, PluginName: "@openclaw/dingtalk"},
		{ID: "matrix", Name: "matrix", DisplayName: "Matrix", NeedsPlugin: true, PluginName: "@openclaw/matrix"},
		{ID: "email", Name: "email", DisplayName: "Email", NeedsPlugin: true, PluginName: "@openclaw/email"},
	}
}

func (a *App) GetChannelConfigFields(channelID string) []ChannelConfigField {
	fieldMap := map[string][]ChannelConfigField{
		"qq":       {{Key: "appId", Label: "App ID", Required: true}, {Key: "secret", Label: "App Secret", Secret: true, Required: true}},
		"telegram": {{Key: "botToken", Label: "Bot Token", Placeholder: "从 @BotFather 获取", Secret: true, Required: true}},
		"feishu":   {{Key: "appId", Label: "App ID", Required: true}, {Key: "appSecret", Label: "App Secret", Secret: true, Required: true}},
		"wecom":    {{Key: "botId", Label: "Bot ID", Required: true}, {Key: "secret", Label: "Bot Secret", Secret: true, Required: true}},
		"discord":  {{Key: "token", Label: "Bot Token", Secret: true, Required: true}},
		"slack":    {{Key: "botToken", Label: "Bot Token (xoxb-)", Secret: true, Required: true}, {Key: "appToken", Label: "App Token (xapp-)", Secret: true, Required: true}},
		"whatsapp": {{Key: "phoneNumber", Label: "手机号", Placeholder: "+86...", Required: true}},
		"dingtalk": {{Key: "clientId", Label: "App Key", Required: true}, {Key: "clientSecret", Label: "App Secret", Secret: true, Required: true}},
		"matrix":   {{Key: "homeserver", Label: "服务器地址", Placeholder: "https://matrix.org", Required: true}, {Key: "userId", Label: "用户 ID", Placeholder: "@bot:matrix.org", Required: true}, {Key: "accessToken", Label: "Access Token", Secret: true, Required: true}},
		"email":    {{Key: "imapHost", Label: "IMAP 主机", Required: true}, {Key: "smtpHost", Label: "SMTP 主机", Required: true}, {Key: "imapUsername", Label: "用户名", Required: true}, {Key: "imapPassword", Label: "密码", Secret: true, Required: true}},
	}

	if fields, ok := fieldMap[channelID]; ok {
		return fields
	}
	return []ChannelConfigField{}
}

func (a *App) InstallChannelPlugin(pluginName string) SimpleResult {
	if a.ctx != nil {
		wruntime.EventsEmit(a.ctx, "channel:installing", pluginName)
	}

	cmd := exec.Command("openclaw", "plugins", "install", pluginName)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := sanitizeOutput(decodeOutputBytes(out))
		if msg == "" {
			msg = err.Error()
		}
		return SimpleResult{Success: false, Error: fmt.Sprintf("安装插件失败: %s", msg)}
	}

	if a.ctx != nil {
		wruntime.EventsEmit(a.ctx, "channel:installed", pluginName)
	}
	return SimpleResult{Success: true, Message: "插件安装成功"}
}

func (a *App) ConfigureChannel(channelID string, config map[string]string) SimpleResult {
	merged := make(map[string]string, len(config)+1)
	for k, v := range config {
		merged[k] = v
	}
	merged["enabled"] = "true"
	for key, value := range merged {
		path := fmt.Sprintf("channels.%s.%s", channelID, key)
		cmd := exec.Command("openclaw", "config", "set", path, value)
		if out, err := cmd.CombinedOutput(); err != nil {
			msg := sanitizeOutput(decodeOutputBytes(out))
			if msg == "" {
				msg = err.Error()
			}
			return SimpleResult{Success: false, Error: fmt.Sprintf("配置 %s 失败: %s", key, msg)}
		}
	}

	return SimpleResult{Success: true, Message: fmt.Sprintf("%s 配置成功", channelID)}
}

func (a *App) readRawConfig() map[string]interface{} {
	path := openclawConfigPath()
	if path == "" {
		return map[string]interface{}{}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return map[string]interface{}{}
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return map[string]interface{}{}
	}
	return raw
}
