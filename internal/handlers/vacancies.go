package handlers

import (
	"errors"
	"strings"
	"time"

	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type vacancyResponse struct {
	ID               uint       `json:"id"`
	SortOrder        int        `json:"sortOrder"`
	Title            string     `json:"title"`
	Schedule         string     `json:"schedule"`
	ScheduleLines    []string   `json:"scheduleLines"`
	Summary          string     `json:"summary"`
	Duties           string     `json:"duties"`
	DutiesList       []string   `json:"dutiesList"`
	Requirements     string     `json:"requirements"`
	RequirementsList []string   `json:"requirementsList"`
	Conditions       string     `json:"conditions"`
	ConditionsList   []string   `json:"conditionsList"`
	Salary           string     `json:"salary"`
	Active           bool       `json:"active"`
	TrashedAt        *time.Time `json:"trashedAt,omitempty"`
}

type vacancyPayload struct {
	Title        string `json:"title"`
	Schedule     string `json:"schedule"`
	Summary      string `json:"summary"`
	Duties       string `json:"duties"`
	Requirements string `json:"requirements"`
	Conditions   string `json:"conditions"`
	Salary       string `json:"salary"`
	Active       *bool  `json:"active"`
}

type vacancyOrderPayload struct {
	OrderedIDs []uint `json:"orderedIds"`
}

func (h *Handler) GetPublicVacancies(c *fiber.Ctx) error {
	var vacancies []models.Vacancy
	if err := h.db.Where("active = ? AND trashed_at IS NULL", true).Order("sort_order asc, id asc").Find(&vacancies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить список вакансий"})
	}

	response := make([]vacancyResponse, 0, len(vacancies))
	for _, vacancy := range vacancies {
		response = append(response, toVacancyResponse(vacancy))
	}

	return c.JSON(response)
}

func (h *Handler) GetAdminVacancies(c *fiber.Ctx) error {
	var vacancies []models.Vacancy
	if err := h.db.Where("trashed_at IS NULL").Order("sort_order asc, id asc").Find(&vacancies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить список вакансий"})
	}

	response := make([]vacancyResponse, 0, len(vacancies))
	for _, vacancy := range vacancies {
		response = append(response, toVacancyResponse(vacancy))
	}

	return c.JSON(response)
}

func (h *Handler) GetAdminTrashVacancies(c *fiber.Ctx) error {
	var vacancies []models.Vacancy
	if err := h.db.Where("trashed_at IS NOT NULL").Order("trashed_at desc, id desc").Find(&vacancies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить корзину вакансий"})
	}

	response := make([]vacancyResponse, 0, len(vacancies))
	for _, vacancy := range vacancies {
		response = append(response, toVacancyResponse(vacancy))
	}

	return c.JSON(response)
}

func (h *Handler) CreateVacancy(c *fiber.Ctx) error {
	var payload vacancyPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные вакансии"})
	}

	title := strings.TrimSpace(payload.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "название вакансии обязательно"})
	}

	sortOrder, err := h.nextVacancySortOrder()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать вакансию"})
	}

	vacancy := models.Vacancy{
		SortOrder:    sortOrder,
		Title:        title,
		Schedule:     normalizeMultiline(payload.Schedule),
		Summary:      strings.TrimSpace(payload.Summary),
		Duties:       normalizeMultiline(payload.Duties),
		Requirements: normalizeMultiline(payload.Requirements),
		Conditions:   normalizeMultiline(payload.Conditions),
		Salary:       strings.TrimSpace(payload.Salary),
		Active:       payload.Active == nil || *payload.Active,
		TrashedAt:    nil,
	}

	if err := h.db.Create(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать вакансию"})
	}

	return c.Status(fiber.StatusCreated).JSON(toVacancyResponse(vacancy))
}

func (h *Handler) UpdateVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("trashed_at IS NULL").First(&vacancy, id).Error; err != nil {
		return respondDBError(c, err)
	}

	var payload vacancyPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные вакансии"})
	}

	title := strings.TrimSpace(payload.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "название вакансии обязательно"})
	}

	vacancy.Title = title
	vacancy.Schedule = normalizeMultiline(payload.Schedule)
	vacancy.Summary = strings.TrimSpace(payload.Summary)
	vacancy.Duties = normalizeMultiline(payload.Duties)
	vacancy.Requirements = normalizeMultiline(payload.Requirements)
	vacancy.Conditions = normalizeMultiline(payload.Conditions)
	vacancy.Salary = strings.TrimSpace(payload.Salary)
	if payload.Active != nil {
		vacancy.Active = *payload.Active
	}

	if err := h.db.Save(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось сохранить вакансию"})
	}

	return c.JSON(toVacancyResponse(vacancy))
}

func (h *Handler) DeleteVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("trashed_at IS NULL").First(&vacancy, id).Error; err != nil {
		return respondDBError(c, err)
	}

	now := time.Now()
	vacancy.Active = false
	vacancy.TrashedAt = &now

	if err := h.db.Save(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось переместить вакансию в корзину"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) PurgeVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	result := h.db.Where("trashed_at IS NOT NULL").Delete(&models.Vacancy{}, id)
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось удалить вакансию навсегда"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "вакансия в корзине не найдена"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) RestoreVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("trashed_at IS NOT NULL").First(&vacancy, id).Error; err != nil {
		return respondDBError(c, err)
	}

	sortOrder, err := h.nextVacancySortOrder()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось восстановить вакансию"})
	}

	vacancy.TrashedAt = nil
	vacancy.SortOrder = sortOrder

	if err := h.db.Save(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось восстановить вакансию"})
	}

	return c.JSON(toVacancyResponse(vacancy))
}

func (h *Handler) EmptyTrashVacancies(c *fiber.Ctx) error {
	if err := h.db.Where("trashed_at IS NOT NULL").Delete(&models.Vacancy{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось очистить корзину"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) ReorderVacancies(c *fiber.Ctx) error {
	var payload vacancyOrderPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный порядок вакансий"})
	}

	if len(payload.OrderedIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "список вакансий пуст"})
	}

	var count int64
	if err := h.db.Model(&models.Vacancy{}).Where("trashed_at IS NULL").Count(&count).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось изменить порядок вакансий"})
	}

	if int64(len(payload.OrderedIDs)) != count {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "передан неполный список вакансий"})
	}

	seen := make(map[uint]struct{}, len(payload.OrderedIDs))
	for _, id := range payload.OrderedIDs {
		if id == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
		}
		if _, ok := seen[id]; ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "в порядке вакансий есть дубликаты"})
		}
		seen[id] = struct{}{}
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for index, id := range payload.OrderedIDs {
			if err := tx.Model(&models.Vacancy{}).Where("id = ?", id).Update("sort_order", index+1).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось изменить порядок вакансий"})
	}

	return h.GetAdminVacancies(c)
}

func toVacancyResponse(v models.Vacancy) vacancyResponse {
	return vacancyResponse{
		ID:               v.ID,
		SortOrder:        v.SortOrder,
		Title:            v.Title,
		Schedule:         v.Schedule,
		ScheduleLines:    models.SplitLines(v.Schedule),
		Summary:          v.Summary,
		Duties:           v.Duties,
		DutiesList:       models.SplitLines(v.Duties),
		Requirements:     v.Requirements,
		RequirementsList: models.SplitLines(v.Requirements),
		Conditions:       v.Conditions,
		ConditionsList:   models.SplitLines(v.Conditions),
		Salary:           v.Salary,
		Active:           v.Active,
		TrashedAt:        v.TrashedAt,
	}
}

func (h *Handler) nextVacancySortOrder() (int, error) {
	var vacancy models.Vacancy
	err := h.db.Order("sort_order desc, id desc").First(&vacancy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 1, nil
	}
	if err != nil {
		return 0, err
	}
	return vacancy.SortOrder + 1, nil
}
