# Sơ đồ chỗ ngồi Giảng đường 1 – bản Vercel (đồng bộ chung)

## Cách triển khai
1. Đưa thư mục này lên GitHub (hoặc dùng `vercel` CLI) và Import vào Vercel (Framework: Other).
2. Vào project → **Storage** → **Create/Connect Database** → chọn **Upstash Redis** (Marketplace) → Connect cho project.
   Vercel sẽ tự thêm biến môi trường `KV_REST_API_URL` và `KV_REST_API_TOKEN`.
3. Vào **Settings → Environment Variables**, thêm:
   - `EDIT_KEY` = mã người chỉnh sửa (vd: EDIT-B6SQ-8QAG)
   - `VIEW_KEY` = mã người xem (vd: VIEW-WMC4-PS6G)
4. **Redeploy** (Deployments → ... → Redeploy) để biến môi trường có hiệu lực.

## Cách hoạt động
- Mã được kiểm tra ở máy chủ (`api/seats.js`), người xem không thể ghi dữ liệu.
- Người chỉnh sửa lưu → máy chủ lưu vào Redis → mọi người đang mở trang tự cập nhật sau tối đa 5 giây.
