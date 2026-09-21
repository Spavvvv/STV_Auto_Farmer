# 🌾 STV Auto Farmer - Tool Cày Cuốc Sangtacviet

Script Tampermonkey mạnh mẽ giúp tự động hóa việc cày cuốc trên Sangtacviet.com: tự động nhặt bảo vật (cơ duyên), tự động cắn đan tối ưu căn cơ, đo Vận Khí và tự động chuyển chương. Phiên bản **v3.8.0** được tinh gọn hoàn toàn, loại bỏ Telegram và mọi phụ thuộc bên ngoài, chỉ tập trung vào một việc duy nhất: cày cuốc ổn định, bền bỉ ngay trên trình duyệt.

## ✨ Tính năng nổi bật (v3.8.0)

### 🎁 Auto Nhặt Đồ (Bảo vật / Cơ duyên)
- Tự động phát hiện và nhặt bảo vật, cơ duyên khi xuất hiện trong chương truyện.
- Gọi hàm xử lý trực tiếp (Bypass UI) kết hợp đọc alert của game để đảm bảo nhận đồ, không bị kẹt luồng.
- Hiển thị **toast thông báo** ngay khi nhặt được bảo vật, kèm tên vật phẩm và lượng Vận Khí đã tiêu tốn.

### 💊 Auto Cắn Đan (Tối ưu căn cơ - vọt max 10k5)
- Tự động ăn đan **400 / 500 / 600 căn cơ** khi điểm tu luyện chưa đạt mục tiêu.
- Sử dụng thuật toán quy hoạch động (Dynamic Programming) để **tự tìm tổ hợp đan tối ưu nhất**, chọn ra hướng cắn đạt **điểm cao nhất có thể — vọt qua 10.000 lên tới tối đa 10.500** với chi phí ít nhất, không lãng phí đan.
- Nhờ bước nhảy 400/500/600, thuật toán không bị khóa cứng ở 10.000 mà linh hoạt vọt lên mức tối ưu (10.050 / 10.200 / 10.500...), rồi mới tự dừng.

### 🍀 Đo Vận Khí Tự Động
- Tự động đọc **Vận Khí hiện tại** từ trang cá nhân (`/user/0/`) trong mỗi chu kỳ.
- Tự động tính chênh lệch Vận Khí trước/sau mỗi lần nhặt để ghi log chi phí chính xác.

### 📖 Tự Động Chuyển Chương
- Tự động cuộn trang mượt mà trong lúc chờ để giả lập hành vi người đọc.
- Chờ ngẫu nhiên **15 - 20 giây** rồi tự động chuyển sang chương sau.
- Tự thử lại nhiều lần nếu chưa tìm thấy link chương sau, tránh bỏ dở phiên cày.

### 🛡️ Fix Triệt Để Lỗi Bắt Nhầm 502/504
- Khắc phục hoàn toàn tình trạng script bắt nhầm cụm **"502/504 Gateway"** nằm trong tiêu đề chương truyện, gây reload liên tục và không thể cày.
- Script **CHỈ** coi là lỗi server thật khi thỏa mãn đồng thời:
  - Nội dung trang **rất ngắn (< 500 ký tự)**, và
  - Tiêu đề/nội dung **trùng chính xác** cụm lỗi Nginx: `504 Gateway Time-out`, `502 Bad Gateway`, `500 Internal Server Error`.
- Chỉ khi đó script mới reload sau 3 giây. Chương truyện bình thường có tiêu đề chứa 502/504 sẽ **không còn bị ảnh hưởng**.

## 🖥️ Giao diện (UI)

- **Panel nổi** ở góc phải dưới màn hình, thiết kế kính mờ (glassmorphism) hiện đại:
  - **Nút bật/tắt Auto:** màu **xanh = ON**, màu **đỏ = OFF**.
  - **Đồng hồ bấm giờ phiên:** tổng thời gian đã cày (được lưu lại qua các lần tải trang).
  - **Số món đồ đã nhặt.**
- **Click vào khu vực thống kê** để mở **bảng thống kê đầy đủ**:
  - 🍀 Vận Khí hiện tại.
  - 🔥 Tổng Vận Khí đã tốn.
  - 🎁 Lịch sử nhặt đồ gần đây (tên vật phẩm, chi phí Vận Khí, thời gian).
  - 🗑️ Nút **Xóa Sạch LocalStorage** để reset toàn bộ lịch sử và thời gian tích lũy.
- **Toast nổi bật** xuất hiện mỗi khi nhặt được bảo vật.

## 🚀 Hướng dẫn cài đặt

### Bước 1: Cài đặt môi trường
1. Cài đặt tiện ích **Tampermonkey** trên trình duyệt (Chrome, Edge, Firefox...).
2. [Bấm vào đây để cài đặt Script](https://github.com/Spavvvv/STV_Auto_Farmer/raw/refs/heads/main/src/stv_farmer.user.js)

### Bước 2: Sử dụng
1. Mở một chương truyện bất kỳ trên **sangtacviet.com** hoặc **sangtacviet.app**.
2. Panel của script sẽ xuất hiện ở góc phải dưới màn hình, bấm nút để **bật Auto** và treo máy cày.
3. Bấm nút lần nữa để **tạm dừng** bất cứ lúc nào.

**Không cần cấu hình gì thêm:** bản v3.8.0 đã loại bỏ hoàn toàn hệ thống Telegram, không cần token, chat ID hay cấp quyền kết nối mạng nào.

### Quyền hoạt động (Permission)
- Script chỉ yêu cầu duy nhất `@grant unsafeWindow`.
- Không còn sử dụng `GM_xmlhttpRequest`, không còn `@connect api.telegram.org`.

## ⚙️ Tùy chỉnh (Customization)

Bạn có thể chỉnh trực tiếp các thông số trong object `CONFIG` ở đầu script cho phù hợp với nhu cầu:

```javascript
const CONFIG = {
    minWait: 15000,       // Thời gian chờ tối thiểu giữa các chương (ms)
    maxWait: 20000,       // Thời gian chờ tối đa giữa các chương (ms)
    pendingTTLms: 20000,  // Thời gian giữ trạng thái chờ nhặt đồ (ms)
    reloadDelay: 3000,    // Độ trễ trước khi reload khi gặp lỗi server (ms)
    maxHistoryItems: 500  // Số món tối đa lưu trong lịch sử nhặt đồ
};
```

## 💡 Vấn đề đã biết (Known Issues)

### 1. Phình to LocalStorage gây lag trình duyệt (đã được khắc phục)
- Ở các phiên bản cũ, script lưu trữ quá nhiều dữ liệu vào localStorage (lịch sử nhặt đồ, thống kê, danh sách đa truyện, trạng thái...). Sau một thời gian dài sử dụng liên tục, dung lượng bộ nhớ localStorage phình to khiến trình duyệt bị lag, chậm, và không thể khắc phục bằng cách thông thường; chỉ còn cách xóa sạch dữ liệu hoặc cài lại trình duyệt.
- Bản v3.8.0 đã tinh gọn: comment/làm gọn logic lưu trữ, giới hạn số mục lịch sử (`maxHistoryItems` mặc định 500), bỏ các dữ liệu không cần thiết, và bổ sung nút **🗑️ Xóa Sạch LocalStorage** trong bảng thống kê để bạn có thể chủ động dọn dẹp bất cứ lúc nào.
- **Lưu ý:** nếu bạn đã từng dùng bản cũ và gặp tình trạng lag, hãy vào bảng thống kê rồi bấm **Xóa Sạch LocalStorage** một lần để làm sạch dữ liệu cũ.

### 2. Hiểu lầm về cơ chế ghi nhận của server (đã làm rõ - cắt bỏ tính năng dư thừa)
- Nhiều người từng nghĩ phải luân chuyển đọc nhiều bộ truyện khác nhau thì server mới ghi nhận lượt đọc/auto farm. Thực tế, server vẫn tính bình thường khi đọc đi đọc lại **MỘT bộ truyện duy nhất**. Việc đọc qua lại nhiều truyện là không bắt buộc và không mang lại lợi ích gì thêm.
- Vì vậy bản v3.8.0 đã loại bỏ các tính năng dư thừa vốn sinh ra để phục vụ hiểu lầm đó: hệ thống quản lý danh sách đa truyện (multi-story list), lệnh swap chuyển truyện, điều khiển từ xa qua Telegram, chế độ ngủ đông sleep... Toàn bộ logic cày cuốc giờ tinh gọn, chạy nhẹ và ổn định ngay trên **MỘT truyện đang đọc**.

## ⚠️ MIỄN TRỪ TRÁCH NHIỆM (DISCLAIMER)
VUI LÒNG ĐỌC KỸ TRƯỚC KHI SỬ DỤNG:

- **Rủi ro tài khoản:** Việc sử dụng tool/bot để can thiệp vào website luôn tiềm ẩn rủi ro bị khóa tài khoản (Ban) hoặc khóa IP. Tôi (tác giả) KHÔNG CHỊU TRÁCH NHIỆM nếu tài khoản của bạn bị khóa vĩnh viễn do sử dụng script này. Hãy cân nhắc kỹ và sử dụng ở mức độ vừa phải (khuyên dùng thời gian chờ mặc định).

- **Mục đích sử dụng:** Script này được viết với mục đích học tập và nghiên cứu kỹ thuật Javascript/Tampermonkey. Không khuyến khích sử dụng để phá hoại hay trục lợi gây ảnh hưởng đến server của web truyện.

- **Bảo mật:** Mã nguồn mở hoàn toàn. Vui lòng KHÔNG trục lợi cho bản thân của bạn.

## 📞 Liên hệ & Gỡ bỏ (DMCA/Contact)
- Nếu bạn là Quản trị viên của Sangtacviet hoặc chủ sở hữu bản quyền và muốn gỡ bỏ repository này, vui lòng liên hệ qua:
- **Issues:** Tạo một Issue trong repository này.

### ⭐ Nếu thấy tool hữu ích, hãy tặng mình 1 Star nhé! ⭐
