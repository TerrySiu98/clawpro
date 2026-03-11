package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

const (
	AppVersion = "0.1.0"
	RepoOwner  = "TerrySiu98"
	RepoName   = "clawpro"
)

type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	DownloadURL    string `json:"downloadURL"`
	ReleaseURL     string `json:"releaseURL"`
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

func (a *App) GetCurrentVersion() string {
	return AppVersion
}

func (a *App) CheckForUpdate() UpdateInfo {
	info := UpdateInfo{
		CurrentVersion: AppVersion,
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", RepoOwner, RepoName)

	resp, err := client.Get(url)
	if err != nil {
		return info
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return info
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return info
	}

	var release githubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return info
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	info.LatestVersion = latest
	info.ReleaseURL = release.HTMLURL

	if latest != "" && latest != AppVersion {
		info.Available = true
		info.DownloadURL = release.HTMLURL
	}

	return info
}

func (a *App) UpdateOpenClaw() SimpleResult {
	if a.ctx == nil {
		return SimpleResult{Success: false, Error: "应用未就绪"}
	}

	cmd := exec.Command("npm", "update", "-g", "openclaw")
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := sanitizeOutput(decodeOutputBytes(out))
		if msg == "" {
			msg = err.Error()
		}
		return SimpleResult{Success: false, Error: fmt.Sprintf("更新失败: %s", msg)}
	}

	return SimpleResult{Success: true, Message: "OpenClaw 引擎已更新到最新版本"}
}
