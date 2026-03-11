package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type BootstrapPayload struct {
	Environment Environment `json:"environment"`
}

type Environment struct {
	Hostname     string `json:"hostname"`
	Platform     string `json:"platform"`
	Architecture string `json:"architecture"`
}

type PostInstallActionResult struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Error     string `json:"error,omitempty"`
	Cancelled bool   `json:"cancelled"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	ensureFullPath()
	a.RepairModelsConfig()
}

func ensureFullPath() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	candidates := []string{
		"/opt/homebrew/bin",
		"/opt/homebrew/sbin",
		"/usr/local/bin",
		"/usr/local/sbin",
		filepath.Join(home, ".volta", "bin"),
		filepath.Join(home, ".fnm", "aliases", "default", "bin"),
		filepath.Join(home, ".cargo", "bin"),
	}

	// nvm: find the highest installed node version
	nvmDir := filepath.Join(home, ".nvm", "versions", "node")
	if entries, err := os.ReadDir(nvmDir); err == nil {
		best := ""
		for _, e := range entries {
			if e.IsDir() && strings.HasPrefix(e.Name(), "v") {
				best = e.Name()
			}
		}
		if best != "" {
			candidates = append(candidates, filepath.Join(nvmDir, best, "bin"))
		}
	}

	currentPath := os.Getenv("PATH")
	parts := strings.Split(currentPath, string(os.PathListSeparator))
	pathSet := make(map[string]bool, len(parts))
	for _, p := range parts {
		pathSet[p] = true
	}

	var added []string
	for _, c := range candidates {
		if pathSet[c] {
			continue
		}
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			added = append(added, c)
		}
	}

	if len(added) > 0 {
		newPath := strings.Join(added, string(os.PathListSeparator)) + string(os.PathListSeparator) + currentPath
		os.Setenv("PATH", newPath)
	}
}

func (a *App) ResizeToChat() {
	if a.ctx != nil {
		wruntime.WindowSetSize(a.ctx, 1440, 920)
		wruntime.WindowCenter(a.ctx)
	}
}

func (a *App) GetBootstrapPayload() BootstrapPayload {
	return BootstrapPayload{
		Environment: Environment{
			Hostname:     readHostname(),
			Platform:     runtime.GOOS,
			Architecture: runtime.GOARCH,
		},
	}
}

func readHostname() string {
	value, err := os.Hostname()
	if err != nil {
		return "unknown-host"
	}
	return value
}

func detectPowerShell() string {
	if path, err := exec.LookPath("pwsh.exe"); err == nil {
		return path
	}
	if path, err := exec.LookPath("powershell.exe"); err == nil {
		return path
	}
	return "not-found"
}
