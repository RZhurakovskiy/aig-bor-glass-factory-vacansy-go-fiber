package handlers

import (
	"database/sql"
	"strings"
	"time"

	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
)

type vacancyViewPayload struct {
	VacancyID uint   `json:"vacancyId"`
	PagePath  string `json:"pagePath"`
}

type vacancyMetricSummaryResponse struct {
	VacancyID    uint   `json:"vacancyId"`
	Title        string `json:"title"`
	ViewsCount   int64  `json:"viewsCount"`
	LastViewedAt string `json:"lastViewedAt"`
	Active       bool   `json:"active"`
}

type vacancyMetricEventResponse struct {
	ID        uint   `json:"id"`
	VacancyID uint   `json:"vacancyId"`
	Title     string `json:"title"`
	IPAddress string `json:"ipAddress"`
	UserAgent string `json:"userAgent"`
	Referrer  string `json:"referrer"`
	PagePath  string `json:"pagePath"`
	ViewedAt  string `json:"viewedAt"`
}

type vacancyMetricsResponse struct {
	TotalViews   int64                          `json:"totalViews"`
	TodayViews   int64                          `json:"todayViews"`
	UniqueIPs    int64                          `json:"uniqueIps"`
	Vacancies    []vacancyMetricSummaryResponse `json:"vacancies"`
	RecentEvents []vacancyMetricEventResponse   `json:"recentEvents"`
}

type vacancyMetricSummaryRow struct {
	VacancyID    uint
	Title        string
	ViewsCount   int64
	LastViewedAt sql.NullString
	Active       bool
}

type vacancyMetricEventRow struct {
	ID        uint
	VacancyID uint
	Title     string
	IPAddress string
	UserAgent string
	Referrer  string
	PagePath  string
	ViewedAt  time.Time
}

func (h *Handler) TrackVacancyView(c *fiber.Ctx) error {
	var payload vacancyViewPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные просмотра"})
	}

	if payload.VacancyID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "идентификатор вакансии обязателен"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("id = ? AND active = ? AND trashed_at IS NULL", payload.VacancyID, true).First(&vacancy).Error; err != nil {
		return respondDBError(c, err)
	}

	view := models.VacancyView{
		VacancyID: payload.VacancyID,
		IPAddress: strings.TrimSpace(c.IP()),
		UserAgent: strings.TrimSpace(c.Get("User-Agent")),
		Referrer:  strings.TrimSpace(c.Get("Referer")),
		PagePath:  strings.TrimSpace(payload.PagePath),
		ViewedAt:  time.Now(),
	}

	if err := h.db.Create(&view).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось сохранить просмотр вакансии"})
	}

	return c.SendStatus(fiber.StatusCreated)
}

func (h *Handler) GetVacancyMetrics(c *fiber.Ctx) error {
	var totalViews int64
	if err := h.db.Model(&models.VacancyView{}).Count(&totalViews).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var todayViews int64
	if err := h.db.Model(&models.VacancyView{}).Where("viewed_at >= ?", startOfDay).Count(&todayViews).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	var uniqueIPs int64
	if err := h.db.Model(&models.VacancyView{}).Distinct("ip_address").Count(&uniqueIPs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	var summaryRows []vacancyMetricSummaryRow
	if err := h.db.Table("vacancy_views").
		Select("vacancy_views.vacancy_id, vacancies.title, COUNT(vacancy_views.id) AS views_count, MAX(vacancy_views.viewed_at) AS last_viewed_at, vacancies.active").
		Joins("JOIN vacancies ON vacancies.id = vacancy_views.vacancy_id").
		Group("vacancy_views.vacancy_id, vacancies.title, vacancies.active").
		Order("views_count DESC, last_viewed_at DESC").
		Scan(&summaryRows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	var eventRows []vacancyMetricEventRow
	if err := h.db.Table("vacancy_views").
		Select("vacancy_views.id, vacancy_views.vacancy_id, vacancies.title, vacancy_views.ip_address, vacancy_views.user_agent, vacancy_views.referrer, vacancy_views.page_path, vacancy_views.viewed_at").
		Joins("JOIN vacancies ON vacancies.id = vacancy_views.vacancy_id").
		Order("vacancy_views.viewed_at DESC").
		Limit(50).
		Scan(&eventRows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	response := vacancyMetricsResponse{
		TotalViews:   totalViews,
		TodayViews:   todayViews,
		UniqueIPs:    uniqueIPs,
		Vacancies:    make([]vacancyMetricSummaryResponse, 0, len(summaryRows)),
		RecentEvents: make([]vacancyMetricEventResponse, 0, len(eventRows)),
	}

	for _, row := range summaryRows {
		response.Vacancies = append(response.Vacancies, vacancyMetricSummaryResponse{
			VacancyID:    row.VacancyID,
			Title:        row.Title,
			ViewsCount:   row.ViewsCount,
			LastViewedAt: formatOptionalDBTime(row.LastViewedAt),
			Active:       row.Active,
		})
	}

	for _, row := range eventRows {
		response.RecentEvents = append(response.RecentEvents, vacancyMetricEventResponse{
			ID:        row.ID,
			VacancyID: row.VacancyID,
			Title:     row.Title,
			IPAddress: row.IPAddress,
			UserAgent: row.UserAgent,
			Referrer:  row.Referrer,
			PagePath:  row.PagePath,
			ViewedAt:  formatOptionalTime(row.ViewedAt),
		})
	}

	return c.JSON(response)
}

func formatOptionalTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(timeLayoutSeconds)
}

func formatOptionalDBTime(value sql.NullString) string {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return ""
	}

	layouts := []string{
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
		time.RFC3339Nano,
		time.RFC3339,
	}

	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value.String)
		if err == nil {
			return parsed.Format(timeLayoutSeconds)
		}
	}

	return value.String
}
