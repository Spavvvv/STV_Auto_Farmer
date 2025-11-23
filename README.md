# 🌾 STV Auto Farmer - Tool Cày Cuốc Sangtacviet

Script Tampermonkey mạnh mẽ giúp tự động hóa việc đọc truyện, điểm danh và săn vật phẩm (cơ duyên) trên trang Sangtacviet.com. Tích hợp hệ thống quản lý đa truyện và điều khiển từ xa qua Telegram.

## ✨ Tính năng nổi bật (v1.0.1 Big Updated 💥)

### 🛠️ Cày Cuốc Tự Động
- **Auto Lật Trang:** Tự động chuyển chương sau thời gian chờ ngẫu nhiên (12-15s), giả lập hành vi người đọc.
- **Auto Nhặt Đồ:** Tự động phát hiện cơ duyên, gọi hàm xử lý trực tiếp (Bypass UI) để đảm bảo nhận đồ 100% không cần click chuột.
- **Smart Filter:** Bộ lọc thông minh giúp phân biệt Popup vật phẩm thật và các Popup rác (như bảng chỉnh Name).

### 📱 Hệ Thống Telegram (Remote Control)
- **Báo cáo Real-time:** Nhắn tin về điện thoại ngay lập tức khi nhặt được đồ (kèm tên vật phẩm và mô tả).
- **Điều khiển từ xa:** Chat với Bot để Bật/Tắt, Thêm truyện, Chuyển truyện, F5 trang web mà không cần ngồi máy.**(💥New )**
- **Anti-Spam:** Cơ chế khóa chéo giúp ngăn chặn việc gửi tin nhắn trùng lặp khi mở nhiều tab. **(💥New )**

### 🔄 Farm Manager (Quản lý Trang Trại) **(💥New )**
- **Cày Đa Truyện:** Lưu danh sách nhiều truyện. Tự động chuyển sang truyện khác khi hết chương hoặc gặp lỗi.
- **Anti-Stuck Pro:** Tự động phát hiện lỗi "Server tự khắc phục", "Tải thất bại" để đổi truyện hoặc F5 ngay lập tức.
- **Chế độ Ngủ Đông:** Tự động cho Bot "đi ngủ" (tạm dừng 30-60p) nếu toàn bộ danh sách truyện đều bị lỗi server, tránh bị Ban IP.

---

## 🕹️ Danh sách Lệnh Telegram (Command)

Sau khi cài đặt, bạn có thể chat với Bot các lệnh sau:

| Lệnh | Chức năng |
| :--- | :--- |
| `/help` | Xem danh sách lệnh hướng dẫn. |
| `/status` | Xem trạng thái hoạt động (Đang chạy/Tắt, Truyện số mấy, Lỗi liên tiếp...). |
| `/start` | Bật Auto từ xa. |
| `/stop` | Tắt Auto từ xa. |
| `/f5` | Ép trình duyệt tải lại trang (Reload). |
| `/add` | Tự động thêm truyện đang đọc vào danh sách cày. |
| `/add [link]` | Thêm một link truyện cụ thể vào danh sách. |
| `/list` | Xem danh sách các truyện đang lưu. |
| `/swap [số]` | Chuyển ngay lập tức sang truyện số thứ tự X trong list. |
| `/del [số]` | Xóa truyện số thứ tự X khỏi list. |
| `/sleep [phút]` | Ra lệnh cho Bot đi ngủ X phút. |
| `/wake` | Đánh thức Bot dậy cày tiếp ngay lập tức. |

---

## 🚀 Hướng dẫn cài đặt

### Bước 1: Cài đặt môi trường
1. Cài đặt tiện ích **Tampermonkey** trên trình duyệt (Chrome, Edge, Firefox...).
2. [Bấm vào đây để cài đặt Script](https://github.com/Spavvvv/STV_Auto_Farmer/raw/refs/heads/main/src/stv_farmer.user.js)

### Bước 2: Cấu hình Telegram (Bắt buộc để nhận thông báo và ra lệnh cho bot)
1. Mở Dashboard của Tampermonkey -> Chọn Script vừa cài -> Bấm Sửa (Edit).
2. Tìm đến dòng đầu tiên của Script:
   ```javascript
   const TELEGRAM_TOKEN = 'ĐIỀN_TOKEN_CỦA_BẠN_VÀO_ĐÂY';
   const TELEGRAM_CHAT_ID = 'ĐIỀN_CHAT_ID_CỦA_BẠN_VÀO_ĐÂY';
   ```
3. Điền Token và Chat ID của bạn vào.
4. Bấm File -> Save (hoặc Ctrl+S).

### Bước 3: Cấp quyền kết nối
1. Vào trang đọc truyện bất kỳ trên Sangtacviet.
2. Tampermonkey sẽ hiện thông báo hỏi quyền kết nối đến api.telegram.org.
   
**QUAN TRỌNG:** Hãy chọn "Always Allow" (Luôn cho phép) để script có thể gửi tin nhắn và nhận lệnh.

### Customization
- Bạn có thể thay đổi thời gian chờ bot lắng nghe lệnh từ telegram (Default: 5s) xuống tùy ý
- Các lệnh có thể được customize tùy theo sở thích

## ⚠️ MIỄN TRỪ TRÁCH NHIỆM (DISCLAIMER)
VUI LÒNG ĐỌC KỸ TRƯỚC KHI SỬ DỤNG:

- **Rủi ro tài khoản:** Việc sử dụng tool/bot để can thiệp vào website luôn tiềm ẩn rủi ro bị khóa tài khoản (Ban) hoặc khóa IP. Tôi (tác giả) KHÔNG CHỊU TRÁCH NHIỆM nếu tài khoản của bạn bị khóa vĩnh viễn do sử dụng script này. Hãy cân nhắc kỹ và sử dụng ở mức độ vừa phải (khuyên dùng thời gian chờ mặc định).

- **Mục đích sử dụng:** Script này được viết với mục đích học tập và nghiên cứu kỹ thuật Javascript/Tampermonkey. Không khuyến khích sử dụng để phá hoại hay trục lợi gây ảnh hưởng đến server của web truyện.

- **Bảo mật:** Mã nguồn mở hoàn toàn. Vui lòng KHÔNG trục lợi cho bản thân của bạn.

## 📞 Liên hệ & Gỡ bỏ (DMCA/Contact)
- Nếu bạn là Quản trị viên của Sangtacviet hoặc chủ sở hữu bản quyền và muốn gỡ bỏ repository này, vui lòng liên hệ qua:
- **Issues:** Tạo một Issue trong repository này.
### ⭐ Nếu thấy tool hữu ích, hãy tặng mình 1 Star nhé! ⭐
