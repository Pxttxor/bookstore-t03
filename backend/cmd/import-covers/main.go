// Command import-covers copies the frontend book-cover assets into PostgreSQL.
package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"bookstore-t03/internal/config"
	"bookstore-t03/internal/database"
)

type coverAsset struct {
	bookID int
	name   string
}

var coverAssets = []coverAsset{
	{101, "atomic-habits-591d57.png"},
	{102, "the-alchemist-761bdf.png"},
	{103, "circe-3ea9d1.png"},
	{104, "project-hail-mary-60c35e.png"},
	{105, "klara-and-the-sun-641378.png"},
	{106, "dune-41c1d5.png"},
	{107, "a-little-life-641378.png"},
	{108, "normal-people-641378.png"},
	{109, "the-midnight-library-1b6823.png"},
	{110, "the-song-of-achilles-591d57.png"},
	{111, "crying-in-h-mart-591d57.png"},
	{112, "lessons-in-chemistry-591d57.png"},
	{113, "evelyn-hugo-591d57.png"},
	{114, "where-the-crawdads-sing-641378.png"},
}

func main() {
	coversDir := flag.String("covers-dir", filepath.Join("..", "frontend", "src", "assets", "covers"), "directory containing cover assets")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fatal(err)
	}
	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	if err := database.Migrate(db); err != nil {
		fatal(err)
	}

	for _, asset := range coverAssets {
		path := filepath.Join(*coversDir, asset.name)
		image, err := os.ReadFile(path)
		if err != nil {
			fatal(fmt.Errorf("read book %d cover %q: %w", asset.bookID, path, err))
		}
		mediaType := http.DetectContentType(image)
		if len(image) == 0 || len(mediaType) < len("image/") || mediaType[:len("image/")] != "image/" {
			fatal(fmt.Errorf("book %d cover %q is not an image", asset.bookID, path))
		}
		result := db.Exec(`
			UPDATE book
			SET cover_image = ?, cover_image_type = ?
			WHERE book_id = ?
		`, image, mediaType, asset.bookID)
		if result.Error != nil {
			fatal(fmt.Errorf("store book %d cover: %w", asset.bookID, result.Error))
		}
		if result.RowsAffected != 1 {
			fatal(fmt.Errorf("book %d was not found", asset.bookID))
		}
		fmt.Printf("book %d: %s (%d bytes)\n", asset.bookID, mediaType, len(image))
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
