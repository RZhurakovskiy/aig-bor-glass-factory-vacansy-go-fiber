package models

import (
	"strings"
	"time"
)

type Vacancy struct {
	ID           uint `gorm:"primaryKey"`
	SortOrder    int
	Title        string
	Schedule     string
	Summary      string
	Duties       string
	Requirements string
	Conditions   string
	Salary       string
	Active       bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Contact struct {
	ID        uint `gorm:"primaryKey"`
	Phones    string
	Email     string
	Address   string
	VK        string
	Telegram  string
	WhatsApp  string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func SplitLines(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}

	parts := strings.Split(value, "\n")
	lines := make([]string, 0, len(parts))
	for _, part := range parts {
		line := strings.TrimSpace(part)
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func JoinLines(lines []string) string {
	clean := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	return strings.Join(clean, "\n")
}

func DefaultContact() Contact {
	return Contact{
		ID:       1,
		Phones:   JoinLines([]string{"+7(987) 532-02-32", "+7(910) 057-28-87"}),
		Email:    "borhrauto@aigrus.ru",
		Address:  "Стеклозаводское шоссе, 16к13",
		VK:       "",
		Telegram: "",
		WhatsApp: "",
	}
}
