package handlers

import (
	"errors"
	"strconv"
	"strings"

	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func normalizeMultiline(value string) string {
	return models.JoinLines(strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n"))
}

func parseUintParam(c *fiber.Ctx, name string) (uint, error) {
	value, err := strconv.ParseUint(c.Params(name), 10, 64)
	return uint(value), err
}

func respondDBError(c *fiber.Ctx, err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "запись не найдена"})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "внутренняя ошибка сервера"})
}
