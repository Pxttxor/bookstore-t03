// Regression checks for the reported checkout, stock, order and review bugs.
// Run only against a disposable test database (like the rest of cmd/smoke).
package main

import "fmt"

func runReportedBugRegression(e *env) {
	section("Regression: checkout / role access / catalogue / reviews")
	for _, address := range []string{"", "  \t", "—", "-"} {
		check(fmt.Sprintf("website rejects missing/placeholder address %q", address), func() error {
			input := orderBody([]any{orderLine(orderBookID, 1)}, 0)
			input["shippingAddress"] = address
			return expectError("POST", "/api/orders", e.customer, input, 422, "ADDRESS_REQUIRED")
		})
	}
	for _, slip := range []string{"", "  \t"} {
		check(fmt.Sprintf("website rejects missing slip %q", slip), func() error {
			input := orderBody([]any{orderLine(orderBookID, 1)}, 0)
			input["slipFileName"] = slip
			// Customers cannot bypass validation by claiming to use the phone channel.
			input["channel"] = "PHONE"
			return expectError("POST", "/api/orders", e.customer, input, 422, "SLIP_REQUIRED")
		})
	}
	check("sales reads stock without warehouse-only endpoints", func() error {
		if _, err := getList(e.sales, "/api/inventory"); err != nil {
			return err
		}
		for _, path := range []string{"/api/stock-counts", "/api/discrepancies", "/api/purchasing/budget"} {
			if err := expectStatus("GET", path, e.sales, nil, 403); err != nil {
				return err
			}
		}
		return nil
	})
	check("cancellation requires a reason and persists it with server action guard", func() error {
		id, err := placeOrder(e.customer, []any{orderLine(orderBookID, 1)})
		if err != nil {
			return err
		}
		path := fmt.Sprintf("/api/orders/%d", id)
		before, err := get(e.sales, path)
		if err != nil {
			return err
		}
		if err := expect(before["canCancel"], true); err != nil {
			return err
		}
		if err := expectError("POST", path+"/cancel", e.sales, map[string]any{"note": "  "}, 422, "REASON_REQUIRED"); err != nil {
			return err
		}
		note := "Regression: customer requested cancellation"
		if _, err := post(e.sales, path+"/cancel", map[string]any{"note": note}, 200); err != nil {
			return err
		}
		after, err := get(e.manager, path)
		if err != nil {
			return err
		}
		if err := expect(after["canCancel"], false); err != nil {
			return err
		}
		if err := expect(after["status"], "CANCELLED"); err != nil {
			return err
		}
		timeline := after["timeline"].([]any)
		return expect(timeline[len(timeline)-1].(map[string]any)["note"], note)
	})
	check("sales confirms website order without losing slip or selected bank", func() error {
		input := orderBody([]any{orderLine(orderBookID, 1)}, 0)
		input["bankId"] = 2
		created, err := post(e.customer, "/api/orders", input, 201)
		if err != nil {
			return err
		}
		id := int(created["orderId"].(float64))
		path := fmt.Sprintf("/api/orders/%d", id)
		if _, err := post(e.sales, path+"/confirm-stock", nil, 200); err != nil {
			return err
		}
		verifying, err := post(e.sales, path+"/payment", map[string]any{"slipFileName": created["slipFileName"]}, 200)
		if err != nil {
			return err
		}
		if err := expect(verifying["canCancel"], false); err != nil {
			return err
		}
		payment, err := paymentOf(e.sales, id)
		if err != nil {
			return err
		}
		if err := expect(payment["bankId"], float64(2)); err != nil {
			return err
		}
		if err := expectError("POST", path+"/reject-payment", e.sales, map[string]any{"note": ""}, 422, "REASON_REQUIRED"); err != nil {
			return err
		}
		note := "Regression: unreadable payment evidence"
		if _, err := post(e.sales, path+"/reject-payment", map[string]any{"note": note}, 200); err != nil {
			return err
		}
		after, err := get(e.sales, path)
		if err != nil {
			return err
		}
		timeline := after["timeline"].([]any)
		return expect(timeline[len(timeline)-1].(map[string]any)["note"], note)
	})
	check("catalogue includes exactly active DB books and matching stock", func() error {
		books, err := getList(e.sales, "/api/books")
		if err != nil {
			return err
		}
		catalogue, err := getList("", "/api/catalogue")
		if err != nil {
			return err
		}
		stock, err := getList(e.sales, "/api/inventory")
		if err != nil {
			return err
		}
		quantities := map[float64]any{}
		for _, value := range stock {
			row := value.(map[string]any)
			quantities[row["bookId"].(float64)] = row["quantityOnHand"]
		}
		active := map[float64]map[string]any{}
		for _, value := range books {
			row := value.(map[string]any)
			if row["status"] == "ACTIVE" {
				active[row["bookId"].(float64)] = row
			}
		}
		if len(active) != len(catalogue) {
			return fmt.Errorf("active DB books=%d catalogue=%d", len(active), len(catalogue))
		}
		for _, value := range catalogue {
			row := value.(map[string]any)
			id := row["bookId"].(float64)
			book, ok := active[id]
			if !ok {
				return fmt.Errorf("catalogue contains inactive/unknown book %.0f", id)
			}
			if err := expect(row["title"], book["title"]); err != nil {
				return err
			}
			if err := expect(row["price"], book["price"]); err != nil {
				return err
			}
			if err := expect(row["quantityOnHand"], quantities[id]); err != nil {
				return fmt.Errorf("stock book %.0f: %w", id, err)
			}
		}
		return nil
	})
	check("sales and manager review metadata matches DB books", func() error {
		books, err := getList(e.sales, "/api/books")
		if err != nil {
			return err
		}
		byID := map[float64]map[string]any{}
		for _, value := range books {
			row := value.(map[string]any)
			byID[row["bookId"].(float64)] = row
		}
		for _, token := range []string{e.sales, e.manager} {
			reviews, err := getList(token, "/api/reviews")
			if err != nil {
				return err
			}
			if len(reviews) == 0 {
				return fmt.Errorf("expected seeded reviews")
			}
			for _, value := range reviews {
				row := value.(map[string]any)
				book := byID[row["bookId"].(float64)]
				for _, field := range []string{"author", "isbn", "price"} {
					if err := expect(row[field], book[field]); err != nil {
						return fmt.Errorf("review field %s: %w", field, err)
					}
				}
			}
		}
		return nil
	})
}
