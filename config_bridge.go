package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type ConfigSnapshot struct {
	Configured      bool   `json:"configured"`
	ApiBaseUrl      string `json:"apiBaseUrl"`
	ApiKey          string `json:"apiKey"`
	DefaultModel    string `json:"defaultModel"`
	DefaultProvider string `json:"defaultProvider"`
}

type ModelInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
}

type SimpleResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func openclawConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".openclaw")
}

func openclawConfigPath() string {
	dir := openclawConfigDir()
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, "openclaw.json")
}

func (a *App) IsOpenClawInstalled() bool {
	_, err := exec.LookPath("openclaw")
	return err == nil
}

func (a *App) IsOpenClawConfigured() bool {
	path := openclawConfigPath()
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && info.Size() > 2
}

// makeModelObject creates the correct OpenClaw model entry format
func makeModelObject(providerName, modelName string) map[string]interface{} {
	fullID := providerName + "/" + modelName
	return map[string]interface{}{
		"id":   fullID,
		"name": modelName,
	}
}

// getModelID extracts the id from a model entry (object or legacy string)
func getModelID(entry interface{}) string {
	if obj, ok := entry.(map[string]interface{}); ok {
		if id, ok := obj["id"].(string); ok {
			return id
		}
	}
	if s, ok := entry.(string); ok {
		return s
	}
	return ""
}

func (a *App) ConfigureProvider(name, baseUrl, apiKey string) SimpleResult {
	return a.ConfigureProviderWithModel(name, baseUrl, apiKey, "")
}

func (a *App) ConfigureProviderWithModel(name, baseUrl, apiKey, modelName string) SimpleResult {
	path := openclawConfigPath()
	if path == "" {
		return SimpleResult{Success: false, Error: "无法找到配置文件路径"}
	}

	raw := readConfigJSON(path)

	models, ok := raw["models"].(map[string]interface{})
	if !ok {
		models = make(map[string]interface{})
	}
	providers, ok := models["providers"].(map[string]interface{})
	if !ok {
		providers = make(map[string]interface{})
	}

	modelsList := []interface{}{}

	// Preserve existing valid models from this provider
	if existing, ok := providers[name].(map[string]interface{}); ok {
		if ml, ok := existing["models"].([]interface{}); ok {
			for _, m := range ml {
				if _, ok := m.(map[string]interface{}); ok {
					modelsList = append(modelsList, m)
				}
			}
		}
	}

	// Add the new model if provided
	if modelName != "" {
		fullID := name + "/" + modelName
		found := false
		for _, m := range modelsList {
			if getModelID(m) == fullID {
				found = true
				break
			}
		}
		if !found {
			modelsList = append([]interface{}{makeModelObject(name, modelName)}, modelsList...)
		}
	}

	providers[name] = map[string]interface{}{
		"baseUrl": baseUrl,
		"apiKey":  apiKey,
		"api":     "openai-completions",
		"models":  modelsList,
	}
	models["providers"] = providers
	raw["models"] = models

	// Set default model if provided
	if modelName != "" {
		setDefaultModelInRaw(raw, name+"/"+modelName)
	}

	return writeConfigJSON(path, raw)
}

func (a *App) AddModel(providerName, modelName string) SimpleResult {
	path := openclawConfigPath()
	if path == "" {
		return SimpleResult{Success: false, Error: "无法找到配置文件路径"}
	}
	raw := readConfigJSON(path)
	provider := getProviderMap(raw, providerName)
	if provider == nil {
		return SimpleResult{Success: false, Error: fmt.Sprintf("供应商 %s 不存在，请先配置 API", providerName)}
	}

	fullID := providerName + "/" + modelName
	modelsList := getModelsArray(provider)

	for _, m := range modelsList {
		if getModelID(m) == fullID {
			return SimpleResult{Success: false, Error: "该模型已存在"}
		}
	}

	modelsList = append(modelsList, makeModelObject(providerName, modelName))
	provider["models"] = modelsList
	setProviderMap(raw, providerName, provider)

	return writeConfigJSON(path, raw)
}

func (a *App) RemoveModel(providerName, modelID string) SimpleResult {
	path := openclawConfigPath()
	if path == "" {
		return SimpleResult{Success: false, Error: "无法找到配置文件路径"}
	}
	raw := readConfigJSON(path)
	provider := getProviderMap(raw, providerName)
	if provider == nil {
		return SimpleResult{Success: false, Error: "供应商不存在"}
	}

	modelsList := getModelsArray(provider)
	filtered := []interface{}{}
	for _, m := range modelsList {
		if getModelID(m) != modelID {
			filtered = append(filtered, m)
		}
	}
	provider["models"] = filtered
	setProviderMap(raw, providerName, provider)

	return writeConfigJSON(path, raw)
}

func (a *App) ListProviderModels(providerName string) []ModelInfo {
	path := openclawConfigPath()
	if path == "" {
		return []ModelInfo{}
	}
	raw := readConfigJSON(path)
	provider := getProviderMap(raw, providerName)
	if provider == nil {
		return []ModelInfo{}
	}

	modelsList := getModelsArray(provider)
	result := []ModelInfo{}
	for _, m := range modelsList {
		id := getModelID(m)
		name := id
		if obj, ok := m.(map[string]interface{}); ok {
			if n, ok := obj["name"].(string); ok {
				name = n
			}
		}
		if id != "" {
			result = append(result, ModelInfo{ID: id, Name: name, Provider: providerName})
		}
	}
	return result
}

func (a *App) SetDefaultModel(modelID string) SimpleResult {
	path := openclawConfigPath()
	if path == "" {
		return SimpleResult{Success: false, Error: "无法找到配置文件路径"}
	}
	raw := readConfigJSON(path)
	setDefaultModelInRaw(raw, modelID)
	return writeConfigJSON(path, raw)
}

func (a *App) SetSystemPrompt(prompt string) SimpleResult {
	path := openclawConfigPath()
	if path == "" {
		return SimpleResult{Success: false, Error: "无法找到配置文件路径"}
	}
	raw := readConfigJSON(path)

	agents, ok := raw["agents"].(map[string]interface{})
	if !ok {
		agents = make(map[string]interface{})
	}
	defaults, ok := agents["defaults"].(map[string]interface{})
	if !ok {
		defaults = make(map[string]interface{})
	}
	defaults["systemPrompt"] = prompt
	agents["defaults"] = defaults
	raw["agents"] = agents

	return writeConfigJSON(path, raw)
}

func (a *App) GetCurrentConfig() ConfigSnapshot {
	snap := ConfigSnapshot{}
	if !a.IsOpenClawInstalled() || !a.IsOpenClawConfigured() {
		return snap
	}

	raw := readConfigJSON(openclawConfigPath())
	snap.Configured = true

	if models, ok := raw["models"].(map[string]interface{}); ok {
		if providers, ok := models["providers"].(map[string]interface{}); ok {
			for name, v := range providers {
				if p, ok := v.(map[string]interface{}); ok {
					if baseUrl, ok := p["baseUrl"].(string); ok {
						snap.ApiBaseUrl = baseUrl
						snap.DefaultProvider = name
					}
					if key, ok := p["apiKey"].(string); ok {
						if len(key) > 8 {
							snap.ApiKey = key[:4] + "****" + key[len(key)-4:]
						} else {
							snap.ApiKey = "****"
						}
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
					snap.DefaultModel = primary
				}
			} else if model, ok := defaults["model"].(string); ok {
				snap.DefaultModel = model
			}
		}
	}

	return snap
}

// GetAvailableModels returns models from the configured provider
func (a *App) GetAvailableModels() []ModelInfo {
	snap := a.GetCurrentConfig()
	if snap.DefaultProvider != "" {
		models := a.ListProviderModels(snap.DefaultProvider)
		if len(models) > 0 {
			return models
		}
	}
	return []ModelInfo{}
}

// RepairModelsConfig fixes string entries in models arrays to object format
func (a *App) RepairModelsConfig() {
	path := openclawConfigPath()
	if path == "" {
		return
	}
	raw := readConfigJSON(path)
	changed := false

	if models, ok := raw["models"].(map[string]interface{}); ok {
		if providers, ok := models["providers"].(map[string]interface{}); ok {
			for pName, pVal := range providers {
				if p, ok := pVal.(map[string]interface{}); ok {
					if ml, ok := p["models"].([]interface{}); ok {
						fixed := []interface{}{}
						for _, m := range ml {
							if s, ok := m.(string); ok {
								fixed = append(fixed, map[string]interface{}{"id": s, "name": s})
								changed = true
							} else {
								fixed = append(fixed, m)
							}
						}
						p["models"] = fixed
						providers[pName] = p
					}
				}
			}
			models["providers"] = providers
			raw["models"] = models
		}
	}

	if changed {
		writeConfigJSON(path, raw)
	}
}

// ── helpers ──

func setDefaultModelInRaw(raw map[string]interface{}, modelID string) {
	agents, ok := raw["agents"].(map[string]interface{})
	if !ok {
		agents = make(map[string]interface{})
	}
	defaults, ok := agents["defaults"].(map[string]interface{})
	if !ok {
		defaults = make(map[string]interface{})
	}
	defaults["model"] = map[string]interface{}{"primary": modelID}
	agents["defaults"] = defaults
	raw["agents"] = agents
}

func getProviderMap(raw map[string]interface{}, name string) map[string]interface{} {
	if models, ok := raw["models"].(map[string]interface{}); ok {
		if providers, ok := models["providers"].(map[string]interface{}); ok {
			if p, ok := providers[name].(map[string]interface{}); ok {
				return p
			}
		}
	}
	return nil
}

func setProviderMap(raw map[string]interface{}, name string, provider map[string]interface{}) {
	models, ok := raw["models"].(map[string]interface{})
	if !ok {
		return
	}
	providers, ok := models["providers"].(map[string]interface{})
	if !ok {
		return
	}
	providers[name] = provider
}

func getModelsArray(provider map[string]interface{}) []interface{} {
	if ml, ok := provider["models"].([]interface{}); ok {
		return ml
	}
	return []interface{}{}
}

func readConfigJSON(path string) map[string]interface{} {
	var raw map[string]interface{}
	data, err := os.ReadFile(path)
	if err != nil {
		return make(map[string]interface{})
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return make(map[string]interface{})
	}
	return raw
}

func writeConfigJSON(path string, raw map[string]interface{}) SimpleResult {
	out, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return SimpleResult{Success: false, Error: fmt.Sprintf("序列化配置失败: %s", err.Error())}
	}
	if err := os.WriteFile(path, out, 0o644); err != nil {
		return SimpleResult{Success: false, Error: fmt.Sprintf("写入配置失败: %s", err.Error())}
	}
	return SimpleResult{Success: true, Message: "配置保存成功"}
}
