package handler

import (
	"encoding/json"
	"testing"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

func TestReviewDTOUsesRealBookMetadata(t *testing.T) {
	row := repository.ReviewRow{
		Review: model.Review{ReviewID: 7, BookID: 42},
		Book:   model.Book{BookID: 42, Title: "Real title", Author: "Real author", ISBN: "9781234567890", Price: 321.5},
	}
	dto := toReviewDTO(row)
	if dto.BookTitle != row.Book.Title || dto.Author != row.Book.Author || dto.ISBN != row.Book.ISBN || dto.Price != row.Book.Price {
		t.Fatalf("book metadata does not match database row: %+v", dto)
	}
	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatal(err)
	}
	if _, ok := body["orderCode"]; ok {
		t.Fatal("unlinked review must not fabricate an order")
	}
	if body["replies"] == nil {
		t.Fatal("replies must be an empty array, not null")
	}
}
