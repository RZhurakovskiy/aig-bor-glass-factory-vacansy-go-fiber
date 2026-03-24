package handlers

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
)

type adminMetaResponse struct {
	Version       string `json:"version"`
	WebVersion    string `json:"webVersion"`
	GoVersion     string `json:"goVersion"`
	Platform      string `json:"platform"`
	Hostname      string `json:"hostname"`
	OSName        string `json:"osName"`
	CurrentRole   string `json:"currentRole"`
	CurrentIsRoot bool   `json:"currentIsRoot"`
}

func (h *Handler) GetAdminMeta(c *fiber.Ctx) error {
	version := strings.TrimSpace(h.appVersion)
	if version == "" {
		version = "dev"
	}
	webVersion := strings.TrimSpace(h.webVersion)
	if webVersion == "" {
		webVersion = "dev"
	}

	hostname, err := os.Hostname()
	if err != nil || strings.TrimSpace(hostname) == "" {
		hostname = "unknown"
	}

	currentRole := ""
	currentIsRoot := false
	if adminUser, ok := c.Locals("adminUser").(models.AdminUser); ok {
		currentRole = adminUser.Role
		currentIsRoot = adminUser.IsRoot
	}

	return c.JSON(adminMetaResponse{
		Version:       version,
		WebVersion:    webVersion,
		GoVersion:     runtime.Version(),
		Platform:      fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
		Hostname:      hostname,
		OSName:        detectOSName(),
		CurrentRole:   currentRole,
		CurrentIsRoot: currentIsRoot,
	})
}

func detectOSName() string {
	if runtime.GOOS != "linux" {
		return runtime.GOOS
	}

	content, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return runtime.GOOS
	}

	for _, line := range strings.Split(string(content), "\n") {
		if !strings.HasPrefix(line, "PRETTY_NAME=") {
			continue
		}

		value := strings.TrimSpace(strings.TrimPrefix(line, "PRETTY_NAME="))
		value = strings.Trim(value, `"`)
		if value != "" {
			return value
		}
	}

	return runtime.GOOS
}
