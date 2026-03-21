package handlers

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type adminMetaResponse struct {
	Version   string `json:"version"`
	GoVersion string `json:"goVersion"`
	Platform  string `json:"platform"`
	Hostname  string `json:"hostname"`
	OSName    string `json:"osName"`
}

func (h *Handler) GetAdminMeta(c *fiber.Ctx) error {
	version := strings.TrimSpace(h.appVersion)
	if version == "" {
		version = "dev"
	}

	hostname, err := os.Hostname()
	if err != nil || strings.TrimSpace(hostname) == "" {
		hostname = "unknown"
	}

	return c.JSON(adminMetaResponse{
		Version:   fmt.Sprintf("Go server %s", version),
		GoVersion: runtime.Version(),
		Platform:  fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
		Hostname:  hostname,
		OSName:    detectOSName(),
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
