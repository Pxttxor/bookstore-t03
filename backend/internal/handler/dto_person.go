// dto_person.go — รูปร่าง JSON ของลูกค้าและบัญชีผู้ใช้
//
// ตาราง customer เก็บแค่ที่อยู่กับวันสมัคร ส่วนชื่อ/อีเมล/เบอร์อยู่ในตาราง person
// หน้าจอต้องการทั้งหมดในก้อนเดียว จึงแบน person เข้ามาที่นี่แทนที่จะให้หน้าจอไล่ join เอง
// (แนวเดียวกับที่ supplierBookDTO แบนรายละเอียดหนังสือเข้ามา)
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type accountDTO struct {
	AccountID   int                 `json:"accountId"`
	Username    string              `json:"username"`
	Status      model.AccountStatus `json:"status"`
	StatusLabel string              `json:"statusLabel"`
	LastLogin   *time.Time          `json:"lastLogin,omitempty"`
}

type customerDTO struct {
	CustomerID     int         `json:"customerId"`
	PersonID       int         `json:"personId"`
	FirstName      string      `json:"firstName"`
	LastName       string      `json:"lastName"`
	Name           string      `json:"name"`
	Email          string      `json:"email"`
	Phone          string      `json:"phone"`
	Address        string      `json:"address"`
	RegisteredDate model.Date  `json:"registeredDate"`
	Account        *accountDTO `json:"account,omitempty"`
}

func toAccountDTO(account *model.UserAccount) *accountDTO {
	if account == nil {
		return nil
	}
	return &accountDTO{
		AccountID:   account.AccountID,
		Username:    account.Username,
		Status:      account.Status,
		StatusLabel: account.Status.Label(),
		LastLogin:   account.LastLogin,
	}
}

func toCustomerDTO(row repository.CustomerRow) customerDTO {
	return customerDTO{
		CustomerID:     row.Customer.CustomerID,
		PersonID:       row.Person.PersonID,
		FirstName:      row.Person.FirstName,
		LastName:       row.Person.LastName,
		Name:           row.Person.Name(),
		Email:          row.Person.Email,
		Phone:          row.Person.Phone,
		Address:        row.Customer.Address,
		RegisteredDate: row.Customer.RegisteredDate,
		Account:        toAccountDTO(row.Account),
	}
}

func toCustomerDTOs(rows []repository.CustomerRow) []customerDTO {
	out := make([]customerDTO, len(rows))
	for i, row := range rows {
		out[i] = toCustomerDTO(row)
	}
	return out
}
