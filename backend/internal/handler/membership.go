// membership.go — handler ของระดับสมาชิก แต้มสะสม ของรางวัล และการแลกแต้ม
//
// การสะสมแต้มไม่มีเส้นทางของตัวเอง — เกิดใน POST /api/orders/{id}/deliver ที่มีอยู่แล้ว
// เพราะแต้มกับการยืนยันรับสินค้าต้องเขียนพร้อมกัน (เหตุผลเดียวกับพัสดุในระบบจัดส่ง)
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/service"
)

// registerMembershipRoutes — ระบบย่อยสมาชิกและแต้มสะสม
//
// ผู้จัดการเป็นเจ้าของระดับสมาชิกและของรางวัล (`StoreManager.manageMemberTier()`)
// ลูกค้าดูแต้มและแลกของรางวัลของตัวเองได้ · ฝ่ายขายดูข้อมูลสมาชิกเพื่อตอบคำถามลูกค้า
func (h *Handler) registerMembershipRoutes(register registrar) {
	register("GET /api/membership-tiers", roleAnyUser, h.listTiers)
	register("POST /api/membership-tiers", roleManager, h.createTier)
	register("PUT /api/membership-tiers/{id}", roleManager, h.updateTier)
	register("DELETE /api/membership-tiers/{id}", roleManager, h.deleteTier)

	// เส้นทาง literal ต้องมาก่อน {id} เพื่อให้อ่านง่าย — ServeMux เลือก literal ให้เองอยู่แล้ว
	register("GET /api/members/me", roleCustomer, h.getMyMembership)
	register("GET /api/members", roleCatalogue, h.listMembers)
	register("GET /api/members/{id}", roleCatalogue, h.getMember)
	register("GET /api/members/{id}/point-transactions", roleAnyUser, h.listPointTransactions)
	register("POST /api/members/{id}/point-adjustments", roleManager, h.adjustPoints)

	register("GET /api/rewards", roleAnyUser, h.listRewards)
	register("POST /api/rewards", roleManager, h.createReward)
	register("PUT /api/rewards/{id}", roleManager, h.updateReward)
	register("DELETE /api/rewards/{id}", roleManager, h.deleteReward)
	register("POST /api/rewards/{id}/redeem", roleCustomer, h.redeemReward)

	register("GET /api/redemptions", roleAnyUser, h.listRedemptions)
}

// ── ระดับสมาชิก ─────────────────────────────────────────────────────────

func (h *Handler) listTiers(w http.ResponseWriter, _ *http.Request) {
	tiers, err := h.members.Tiers()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, tiers)
}

func (h *Handler) createTier(w http.ResponseWriter, r *http.Request) {
	var body service.TierInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	tier, err := h.members.CreateTier(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, tier)
}

func (h *Handler) updateTier(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.TierInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	tier, err := h.members.UpdateTier(id, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, tier)
}

func (h *Handler) deleteTier(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.members.DeleteTier(id); err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.NoContent(w)
}

// ── สมาชิก ──────────────────────────────────────────────────────────────

func (h *Handler) listMembers(w http.ResponseWriter, _ *http.Request) {
	views, err := h.members.List()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toMemberDTOs(views))
}

func (h *Handler) getMyMembership(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.members.Me(*current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toMemberDTO(*view))
}

func (h *Handler) getMember(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.members.Get(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toMemberDTO(*view))
}

func (h *Handler) listPointTransactions(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	txns, err := h.members.PointHistory(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPointTransactionDTOs(txns))
}

func (h *Handler) adjustPoints(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.PointAdjustmentInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.members.AdjustPoints(id, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toMemberDTO(*view))
}

// ── ของรางวัล ───────────────────────────────────────────────────────────

func (h *Handler) listRewards(w http.ResponseWriter, _ *http.Request) {
	rewards, err := h.members.Rewards()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRewardDTOs(rewards))
}

func (h *Handler) createReward(w http.ResponseWriter, r *http.Request) {
	var body service.RewardInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	reward, err := h.members.CreateReward(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toRewardDTO(*reward))
}

func (h *Handler) updateReward(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.RewardInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	reward, err := h.members.UpdateReward(id, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRewardDTO(*reward))
}

func (h *Handler) deleteReward(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.members.DeleteReward(id); err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.NoContent(w)
}

// ── การแลกแต้ม ──────────────────────────────────────────────────────────

func (h *Handler) redeemReward(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.members.Redeem(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toRedemptionDTO(*view))
}

func (h *Handler) listRedemptions(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	views, err := h.members.Redemptions(*current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRedemptionDTOs(views))
}
