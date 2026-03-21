package assets

import "embed"

// Files contains the single source of truth for embedded frontend assets.
//
//go:embed static
var Files embed.FS
