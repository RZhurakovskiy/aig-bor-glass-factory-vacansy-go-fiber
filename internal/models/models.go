package models

import (
	"strings"
	"time"
)

const (
	AdminUserRoleAdmin  = "admin"
	AdminUserRoleHR     = "hr"
	BootstrapAdminLogin = "hrautomotive_admin"
	DeveloperAdminLogin = "developer_admin"
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
	TrashedAt    *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Contact struct {
	ID           uint `gorm:"primaryKey"`
	Phones       string
	Email        string
	Address      string
	MapLatitude  float64
	MapLongitude float64
	MapURL       string
	VK           string
	Telegram     string
	WhatsApp     string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type AdminUser struct {
	ID           uint   `gorm:"primaryKey"`
	Login        string `gorm:"uniqueIndex;size:191;not null"`
	PasswordHash string `gorm:"not null"`
	Role         string `gorm:"size:32;not null"`
	Active       bool
	IsRoot       bool `gorm:"not null;default:false"`
	IsProtected  bool `gorm:"not null;default:false"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type VacancyView struct {
	ID        uint `gorm:"primaryKey"`
	VacancyID uint `gorm:"index;not null"`
	IPAddress string
	UserAgent string
	Referrer  string
	PagePath  string
	ViewedAt  time.Time `gorm:"index;not null"`
	CreatedAt time.Time
	Vacancy   Vacancy `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:VacancyID"`
}

type SiteVisit struct {
	ID        uint `gorm:"primaryKey"`
	IPAddress string
	UserAgent string
	Referrer  string
	PagePath  string
	VisitedAt time.Time `gorm:"index;not null"`
	CreatedAt time.Time
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
		ID:           1,
		Phones:       JoinLines([]string{"+7(987) 532-02-32", "+7(910) 057-28-87"}),
		Email:        "borhrauto@aigrus.ru",
		Address:      "Стеклозаводское шоссе, 16к13",
		MapLatitude:  56.334612,
		MapLongitude: 44.103409,
		MapURL:       "https://yandex.ru/maps/-/CHtIrG~I",
		VK:           "",
		Telegram:     "",
		WhatsApp:     "",
	}
}
