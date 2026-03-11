package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type SessionInfo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Model     string `json:"model"`
	UpdatedAt string `json:"updatedAt"`
	Messages  int    `json:"messages"`
}

type SessionMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp,omitempty"`
}

type sessionData struct {
	ID        string           `json:"id"`
	Title     string           `json:"title"`
	UpdatedAt string           `json:"updatedAt"`
	Messages  []SessionMessage `json:"messages"`
}

type sessionsFile struct {
	Sessions []sessionData `json:"sessions"`
}

var sessionsMu sync.Mutex

func sessionsFilePath() string {
	dir := openclawConfigDir()
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, "sifu-sessions.json")
}

func readSessionsFile() sessionsFile {
	path := sessionsFilePath()
	if path == "" {
		return sessionsFile{}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return sessionsFile{}
	}
	var sf sessionsFile
	if err := json.Unmarshal(data, &sf); err != nil {
		return sessionsFile{}
	}
	return sf
}

func writeSessionsFile(sf sessionsFile) error {
	path := sessionsFilePath()
	if path == "" {
		return fmt.Errorf("cannot determine sessions file path")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(sf, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (a *App) ListSessions() []SessionInfo {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	sf := readSessionsFile()
	result := make([]SessionInfo, 0, len(sf.Sessions))
	for _, s := range sf.Sessions {
		result = append(result, SessionInfo{
			ID:        s.ID,
			Title:     s.Title,
			UpdatedAt: s.UpdatedAt,
			Messages:  len(s.Messages),
		})
	}
	return result
}

func (a *App) GetSessionHistory(sessionID string) []SessionMessage {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	sf := readSessionsFile()
	for _, s := range sf.Sessions {
		if s.ID == sessionID {
			return s.Messages
		}
	}
	return []SessionMessage{}
}

func (a *App) CreateSession() SimpleResult {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	id := fmt.Sprintf("s_%d", time.Now().UnixNano())
	now := time.Now().Format(time.RFC3339)

	sf := readSessionsFile()
	sf.Sessions = append([]sessionData{{
		ID:        id,
		Title:     "新对话",
		UpdatedAt: now,
		Messages:  []SessionMessage{},
	}}, sf.Sessions...)

	if err := writeSessionsFile(sf); err != nil {
		return SimpleResult{Success: false, Error: err.Error()}
	}
	return SimpleResult{Success: true, Message: id}
}

// SaveMessage persists a single message into the given session.
// If the session title is still the default, it auto-sets the title from the first user message.
func (a *App) SaveMessage(sessionID, role, content string) SimpleResult {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	sf := readSessionsFile()
	for i, s := range sf.Sessions {
		if s.ID == sessionID {
			sf.Sessions[i].Messages = append(sf.Sessions[i].Messages, SessionMessage{
				Role:      role,
				Content:   content,
				Timestamp: time.Now().Format(time.RFC3339),
			})
			sf.Sessions[i].UpdatedAt = time.Now().Format(time.RFC3339)

			if role == "user" && s.Title == "新对话" {
				runes := []rune(content)
				if len(runes) > 20 {
					sf.Sessions[i].Title = string(runes[:20]) + "..."
				} else {
					sf.Sessions[i].Title = content
				}
			}

			if err := writeSessionsFile(sf); err != nil {
				return SimpleResult{Success: false, Error: err.Error()}
			}
			return SimpleResult{Success: true}
		}
	}
	return SimpleResult{Success: false, Error: "会话不存在"}
}

func (a *App) RenameSession(sessionID, newTitle string) SimpleResult {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	sf := readSessionsFile()
	for i, s := range sf.Sessions {
		if s.ID == sessionID {
			sf.Sessions[i].Title = newTitle
			sf.Sessions[i].UpdatedAt = time.Now().Format(time.RFC3339)
			if err := writeSessionsFile(sf); err != nil {
				return SimpleResult{Success: false, Error: err.Error()}
			}
			return SimpleResult{Success: true}
		}
	}
	return SimpleResult{Success: false, Error: "会话不存在"}
}

func (a *App) DeleteSession(sessionID string) SimpleResult {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	sf := readSessionsFile()
	filtered := make([]sessionData, 0, len(sf.Sessions))
	found := false
	for _, s := range sf.Sessions {
		if s.ID == sessionID {
			found = true
			continue
		}
		filtered = append(filtered, s)
	}
	if !found {
		return SimpleResult{Success: false, Error: "会话不存在"}
	}
	sf.Sessions = filtered
	if err := writeSessionsFile(sf); err != nil {
		return SimpleResult{Success: false, Error: err.Error()}
	}
	return SimpleResult{Success: true}
}
