package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	activeCancel context.CancelFunc
	cancelMu     sync.Mutex
)

func (a *App) EnsureGatewayRunning() SimpleResult {
	if isGatewayReady() {
		return SimpleResult{Success: true, Message: "Gateway 已运行"}
	}

	if err := ensureGatewayModeLocal(); err != nil {
		return SimpleResult{Success: false, Error: err.Error()}
	}

	if err := startGatewayService(); err != nil {
		if err := launchGatewayFallback(); err != nil {
			return SimpleResult{Success: false, Error: fmt.Sprintf("无法启动 Gateway: %s", err.Error())}
		}
	}

	if err := waitForGatewayReady(20 * time.Second); err != nil {
		return SimpleResult{Success: false, Error: "Gateway 启动超时"}
	}

	return SimpleResult{Success: true, Message: "Gateway 已启动"}
}

func isGatewayReady() bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:18789/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

type chatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type providerCfg struct {
	baseURL      string
	apiKey       string
	model        string
	systemPrompt string
}

// SendMessage accepts a JSON array of {role, content} messages and streams
// the completion via the provider's OpenAI-compatible SSE API.
func (a *App) SendMessage(messagesJSON string) SimpleResult {
	if a.ctx == nil {
		return SimpleResult{Success: false, Error: "应用未就绪"}
	}

	var chatMessages []chatMsg
	if err := json.Unmarshal([]byte(messagesJSON), &chatMessages); err != nil {
		return SimpleResult{Success: false, Error: "消息格式错误"}
	}

	cfg := a.readRawProviderConfig()
	if cfg.baseURL == "" || cfg.apiKey == "" || cfg.model == "" {
		return SimpleResult{Success: false, Error: "未配置 API 供应商或模型"}
	}

	ctx, cancel := context.WithCancel(context.Background())

	cancelMu.Lock()
	if activeCancel != nil {
		activeCancel()
	}
	activeCancel = cancel
	cancelMu.Unlock()

	go func() {
		defer cancel()
		a.streamChat(ctx, cfg, chatMessages)
	}()

	return SimpleResult{Success: true, Message: "消息已发送"}
}

func (a *App) readRawProviderConfig() providerCfg {
	var cfg providerCfg
	path := openclawConfigPath()
	if path == "" {
		return cfg
	}
	raw := readConfigJSON(path)

	if models, ok := raw["models"].(map[string]interface{}); ok {
		if providers, ok := models["providers"].(map[string]interface{}); ok {
			for _, v := range providers {
				if p, ok := v.(map[string]interface{}); ok {
					if u, ok := p["baseUrl"].(string); ok {
						cfg.baseURL = u
					}
					if k, ok := p["apiKey"].(string); ok {
						cfg.apiKey = k
					}
				}
				break
			}
		}
	}

	if agents, ok := raw["agents"].(map[string]interface{}); ok {
		if defaults, ok := agents["defaults"].(map[string]interface{}); ok {
			if model, ok := defaults["model"].(map[string]interface{}); ok {
				if primary, ok := model["primary"].(string); ok {
					cfg.model = primary
				}
			} else if model, ok := defaults["model"].(string); ok {
				cfg.model = model
			}
			if sp, ok := defaults["systemPrompt"].(string); ok {
				cfg.systemPrompt = sp
			}
		}
	}

	return cfg
}

func (a *App) streamChat(ctx context.Context, cfg providerCfg, messages []chatMsg) {
	model := cfg.model
	if idx := strings.Index(model, "/"); idx >= 0 {
		model = model[idx+1:]
	}

	apiMessages := make([]chatMsg, 0, len(messages)+1)
	if cfg.systemPrompt != "" {
		apiMessages = append(apiMessages, chatMsg{Role: "system", Content: cfg.systemPrompt})
	}
	apiMessages = append(apiMessages, messages...)

	reqBody, _ := json.Marshal(map[string]interface{}{
		"model":    model,
		"messages": apiMessages,
		"stream":   true,
	})

	url := strings.TrimSuffix(cfg.baseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBody))
	if err != nil {
		wruntime.EventsEmit(a.ctx, "chat:error", err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.apiKey)

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		if ctx.Err() == context.Canceled {
			wruntime.EventsEmit(a.ctx, "chat:stopped", "已停止生成")
			return
		}
		wruntime.EventsEmit(a.ctx, "chat:error", err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		wruntime.EventsEmit(a.ctx, "chat:error", fmt.Sprintf("API 错误 (%d): %s", resp.StatusCode, string(body)))
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		if ctx.Err() != nil {
			wruntime.EventsEmit(a.ctx, "chat:stopped", "已停止生成")
			return
		}
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(data), &chunk) != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			wruntime.EventsEmit(a.ctx, "chat:token", chunk.Choices[0].Delta.Content)
		}
	}

	wruntime.EventsEmit(a.ctx, "chat:done", "")
}

func (a *App) RestartGateway() SimpleResult {
	cmd := exec.CommandContext(context.Background(), "openclaw", "gateway", "restart")
	out, err := cmd.CombinedOutput()
	if err != nil {
		if err2 := startGatewayService(); err2 != nil {
			if err3 := launchGatewayFallback(); err3 != nil {
				return SimpleResult{Success: false, Error: "网关重启失败"}
			}
		}
	}
	_ = out
	return SimpleResult{Success: true, Message: "网关已重启"}
}

func (a *App) StopGeneration() SimpleResult {
	cancelMu.Lock()
	defer cancelMu.Unlock()

	if activeCancel != nil {
		activeCancel()
		activeCancel = nil
		return SimpleResult{Success: true, Message: "已停止生成"}
	}
	return SimpleResult{Success: false, Error: "没有正在运行的任务"}
}
