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

type siteVisitPayload struct {
	PagePath string `json:"pagePath"`
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
	SiteVisits   siteVisitMetricsResponse       `json:"siteVisits"`
	DailyViews   []vacancyDailyViewsResponse    `json:"dailyViews"`
	Vacancies    []vacancyMetricSummaryResponse `json:"vacancies"`
	RecentEvents []vacancyMetricEventResponse   `json:"recentEvents"`
}

type siteVisitMetricsResponse struct {
	TotalVisits  int64                    `json:"totalVisits"`
	TodayVisits  int64                    `json:"todayVisits"`
	UniqueIPs    int64                    `json:"uniqueIps"`
	RecentVisits []siteVisitEventResponse `json:"recentVisits"`
}

type siteVisitEventResponse struct {
	ID        uint   `json:"id"`
	IPAddress string `json:"ipAddress"`
	UserAgent string `json:"userAgent"`
	Referrer  string `json:"referrer"`
	PagePath  string `json:"pagePath"`
	VisitedAt string `json:"visitedAt"`
}

type vacancyDailyViewsResponse struct {
	Date       string                        `json:"date"`
	Label      string                        `json:"label"`
	ViewsCount int64                         `json:"viewsCount"`
	Segments   []vacancyDailySegmentResponse `json:"segments"`
}

type vacancyDailySegmentResponse struct {
	VacancyID  uint   `json:"vacancyId"`
	Title      string `json:"title"`
	ViewsCount int64  `json:"viewsCount"`
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

type vacancyDailyViewsRow struct {
	ViewDate   string
	VacancyID  uint
	Title      string
	ViewsCount int64
}

type siteVisitEventRow struct {
	ID        uint
	IPAddress string
	UserAgent string
	Referrer  string
	PagePath  string
	VisitedAt time.Time
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

func (h *Handler) TrackSiteVisit(c *fiber.Ctx) error {
	var payload siteVisitPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные посещения"})
	}

	visit := models.SiteVisit{
		IPAddress: strings.TrimSpace(c.IP()),
		UserAgent: strings.TrimSpace(c.Get("User-Agent")),
		Referrer:  strings.TrimSpace(c.Get("Referer")),
		PagePath:  strings.TrimSpace(payload.PagePath),
		VisitedAt: time.Now(),
	}

	if err := h.db.Create(&visit).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось сохранить посещение страницы"})
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

	var totalSiteVisits int64
	if err := h.db.Model(&models.SiteVisit{}).Count(&totalSiteVisits).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	var todaySiteVisits int64
	if err := h.db.Model(&models.SiteVisit{}).Where("visited_at >= ?", startOfDay).Count(&todaySiteVisits).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	var uniqueSiteIPs int64
	if err := h.db.Model(&models.SiteVisit{}).Distinct("ip_address").Count(&uniqueSiteIPs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	startDate := startOfDay.AddDate(0, 0, -13)

	var dailyRows []vacancyDailyViewsRow
	if err := h.db.Table("vacancy_views").
		Select("DATE(vacancy_views.viewed_at) AS view_date, vacancy_views.vacancy_id, vacancies.title, COUNT(vacancy_views.id) AS views_count").
		Joins("JOIN vacancies ON vacancies.id = vacancy_views.vacancy_id").
		Where("viewed_at >= ?", startDate).
		Group("DATE(vacancy_views.viewed_at), vacancy_views.vacancy_id, vacancies.title").
		Order("view_date asc, views_count desc, vacancies.title asc").
		Scan(&dailyRows).Error; err != nil {
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

	var siteVisitRows []siteVisitEventRow
	if err := h.db.Table("site_visits").
		Select("site_visits.id, site_visits.ip_address, site_visits.user_agent, site_visits.referrer, site_visits.page_path, site_visits.visited_at").
		Order("site_visits.visited_at DESC").
		Limit(30).
		Scan(&siteVisitRows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить метрики"})
	}

	response := vacancyMetricsResponse{
		TotalViews: totalViews,
		TodayViews: todayViews,
		UniqueIPs:  uniqueIPs,
		SiteVisits: siteVisitMetricsResponse{
			TotalVisits:  totalSiteVisits,
			TodayVisits:  todaySiteVisits,
			UniqueIPs:    uniqueSiteIPs,
			RecentVisits: make([]siteVisitEventResponse, 0, len(siteVisitRows)),
		},
		DailyViews:   buildDailyViewsResponse(startDate, dailyRows),
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

	for _, row := range siteVisitRows {
		response.SiteVisits.RecentVisits = append(response.SiteVisits.RecentVisits, siteVisitEventResponse{
			ID:        row.ID,
			IPAddress: row.IPAddress,
			UserAgent: row.UserAgent,
			Referrer:  row.Referrer,
			PagePath:  row.PagePath,
			VisitedAt: formatOptionalTime(row.VisitedAt),
		})
	}

	return c.JSON(response)
}

func buildDailyViewsResponse(startDate time.Time, rows []vacancyDailyViewsRow) []vacancyDailyViewsResponse {
	viewsByDate := make(map[string]int64, len(rows))
	segmentsByDate := make(map[string][]vacancyDailySegmentResponse, len(rows))
	for _, row := range rows {
		viewsByDate[row.ViewDate] += row.ViewsCount
		segmentsByDate[row.ViewDate] = append(segmentsByDate[row.ViewDate], vacancyDailySegmentResponse{
			VacancyID:  row.VacancyID,
			Title:      row.Title,
			ViewsCount: row.ViewsCount,
		})
	}

	daily := make([]vacancyDailyViewsResponse, 0, 14)
	for index := 0; index < 14; index++ {
		current := startDate.AddDate(0, 0, index)
		dateKey := current.Format("2006-01-02")
		daily = append(daily, vacancyDailyViewsResponse{
			Date:       dateKey,
			Label:      current.Format("02.01"),
			ViewsCount: viewsByDate[dateKey],
			Segments:   segmentsByDate[dateKey],
		})
	}

	return daily
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
