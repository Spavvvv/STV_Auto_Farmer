# 🌾 STV Auto Farmer - Tool Cày Cuốc Sangtacviet

Script Tampermonkey giúp tự động hóa việc đọc truyện, điểm danh và nhặt vật phẩm (cơ duyên) trên trang Sangtacviet.com. Hỗ trợ báo cáo chi tiết về Telegram.

## ✨ Tính năng chính
- **Tự động lật trang:** Tự động chuyển chương sau khi hết thời gian chờ (ngẫu nhiên 12-15s).
- **Auto Nhặt Đồ:** Tự động phát hiện và nhặt vật phẩm/cơ duyên.
- **Bypass UI:** Sử dụng cơ chế gọi hàm trực tiếp (Direct Call) và `unsafeWindow` để đảm bảo hoạt động mượt mà, không phụ thuộc vào việc click nút.
- **Smart Filter:** Bộ lọc thông minh giúp phân biệt Popup vật phẩm và các Popup rác (như bảng chỉnh Name).
- **Telegram Report:** Báo cáo ngay lập tức về điện thoại khi nhặt được đồ hoặc gặp lỗi treo máy.
- **Anti-Stuck:** Tự động F5 khi gặp lỗi tải chương hoặc mất kết nối.

## 🚀 Hướng dẫn cài đặt

### Bước 1: Cài đặt môi trường
1. Cài đặt tiện ích **Tampermonkey** trên trình duyệt (Chrome, Edge, Firefox...).
2. [Bấm vào đây để cài đặt Script](https://github.com/Spavvvv/STV_Auto_Farmer/raw/refs/heads/main/src/stv_farmer.user.js)

### Bước 2: Cấu hình Telegram (Bắt buộc để nhận thông báo)
1. Mở Dashboard của Tampermonkey -> Chọn Script vừa cài -> Bấm Sửa (Edit).
2. Tìm đến dòng đầu tiên của Script:
   ```javascript
   const TELEGRAM_TOKEN = 'ĐIỀN_TOKEN_CỦA_BẠN_VÀO_ĐÂY';
   const TELEGRAM_CHAT_ID = 'ĐIỀN_CHAT_ID_CỦA_BẠN_VÀO_ĐÂY';
   ```
3. Điền Token và Chat ID của bạn vào.
4. Bấm File -> Save (hoặc Ctrl+S).

## ⚠️ MIỄN TRỪ TRÁCH NHIỆM (DISCLAIMER)
VUI LÒNG ĐỌC KỸ TRƯỚC KHI SỬ DỤNG:

- **Rủi ro tài khoản:** Việc sử dụng tool/bot để can thiệp vào website luôn tiềm ẩn rủi ro bị khóa tài khoản (Ban) hoặc khóa IP. Tôi (tác giả) KHÔNG CHỊU TRÁCH NHIỆM nếu tài khoản của bạn bị khóa vĩnh viễn do sử dụng script này. Hãy cân nhắc kỹ và sử dụng ở mức độ vừa phải (khuyên dùng thời gian chờ mặc định).

- **Mục đích sử dụng:** Script này được viết với mục đích học tập và nghiên cứu kỹ thuật Javascript/Tampermonkey. Không khuyến khích sử dụng để phá hoại hay trục lợi gây ảnh hưởng đến server của web truyện.

- **Bảo mật:** Mã nguồn mở hoàn toàn. Vui lòng KHÔNG trục lợi cho bản thân của bạn.

## 📞 Liên hệ & Gỡ bỏ (DMCA/Contact)
- Nếu bạn là Quản trị viên của Sangtacviet hoặc chủ sở hữu bản quyền và muốn gỡ bỏ repository này, vui lòng liên hệ qua:
- **Issues:** Tạo một Issue trong repository này.
- **Hoặc đơn giản hơn**: Admin web fix code hiện tại là được.

- Tôi sẽ tiến hành gỡ bỏ hoặc điều chỉnh mã nguồn ngay lập tức khi nhận được yêu cầu.
⭐ Nếu thấy tool hữu ích, hãy tặng mình 1 Star nhé! ⭐
