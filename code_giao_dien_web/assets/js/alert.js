import { initializeMQTT, fetchThresholds } from "../js/hamcanhbao.js";
document.addEventListener("DOMContentLoaded", async function () {
    // Kiểm tra thông tin người dùng từ localStorage
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // Hiển thị vai trò người dùng
    displayUserRole(user.role_id);
    // Phân quyền dựa trên role_id
    handleUserRole(user.role_id);
    await fetchThresholds(); // Lấy ngưỡng cảm biến từ API
    initializeMQTT(); // Kết nối MQTT
    // Khởi tạo với role_id
    fetchAlerts(user.role_id);
    setInterval(async () => {
        fetchRealTimeAlerts(user.role_id);
    }, 1000);
});

function displayUserRole(role_id) {
    const roleElement = document.getElementById("user-role");
    if (!roleElement) return;

    const roles = {
        1: "Super Admin",
        2: "Admin Trạm 1",
        3: "Admin Trạm 2",
        4: "Viewer"
    };

    roleElement.textContent = "Vai trò: " + (roles[role_id] || "Không xác định");
}

function handleUserRole(role_id) {
    const restrictedLinks = {
        2: ["quanlyuser.html", "giamsat2.html", "dieukhien2.html"],
        3: ["quanlyuser.html", "giamsat1.html", "dieukhien1.html"],
        4: ["quanlyuser.html", "dieukhien2.html", "dieukhien1.html", "device.html", "report.html"]
    };

    document.querySelectorAll(".menu a, .menu .subnavbtn").forEach(item => {
        const href = item.getAttribute("href");
        if (restrictedLinks[role_id]?.includes(href)) {
            item.style.display = "none";
        }
    });
}

const API_URL = "http://localhost/routes/getAlert.php";

// Hiển thị cảnh báo thời gian thực
async function fetchAlerts(role_id) {
    try {
        const response = await fetch(API_URL);
        let allAlerts = await response.json();

        // Lọc cảnh báo theo role_id
        let filteredAlerts;
        if (role_id === 2) {
            // Admin Trạm 1: Chỉ hiển thị cảnh báo của cảm biến có sensor_id bắt đầu bằng "Lab001"
            filteredAlerts = allAlerts.filter(alert => alert.sensor_id && alert.sensor_id.startsWith("Lab001"));
        } else if (role_id === 3) {
            // Admin Trạm 2: Chỉ hiển thị cảnh báo của cảm biến có sensor_id bắt đầu bằng "A4002"
            filteredAlerts = allAlerts.filter(alert => alert.sensor_id && alert.sensor_id.startsWith("A4002"));
        } else {
            // Super Admin (role_id = 1) hoặc Viewer (role_id = 4): Hiển thị tất cả
            filteredAlerts = allAlerts;
        }


        console.log("Cảnh báo  (sau khi lọc):", filteredAlerts);
        renderAlerts(filteredAlerts);
    } catch (error) {
        console.error("Lỗi khi tải cảnh báo thời gian thực:", error);
    }
}
async function fetchRealTimeAlerts(role_id) {
    try {
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
        // Chuyển đổi sang định dạng MySQL
        const mysqlNow = formatDateForMySQL(now);
        const mysqlTwoMinutesAgo = formatDateForMySQL(twoMinutesAgo);

        console.log("Thời gian MySQL - Now:", mysqlNow);
        console.log("Thời gian MySQL - 2 phút trước:", mysqlTwoMinutesAgo);

        const response = await fetch(`${API_URL}?start_date=${encodeURIComponent(mysqlTwoMinutesAgo)}&end_date=${encodeURIComponent(mysqlNow)}`);
        let allRealtimeAlerts = await response.json();

        // Lọc cảnh báo theo role_id
        let filteredRealtimAlerts;
        if (role_id === 2) {
            // Admin Trạm 1: Chỉ hiển thị cảnh báo của cảm biến có sensor_id bắt đầu bằng "Lab001"
            filteredRealtimAlerts = allRealtimeAlerts.filter(alert => alert.sensor_id && alert.sensor_id.startsWith("Lab001"));
        } else if (role_id === 3) {
            // Admin Trạm 2: Chỉ hiển thị cảnh báo của cảm biến có sensor_id bắt đầu bằng "A4002"
            filteredRealtimAlerts = allRealtimeAlerts.filter(alert => alert.sensor_id && alert.sensor_id.startsWith("A4002"));
        } else {
            // Super Admin (role_id = 1) hoặc Viewer (role_id = 4): Hiển thị tất cả
            filteredRealtimAlerts = allRealtimeAlerts;
        }


        console.log("Cảnh báo thời gian thực (sau khi lọc):", filteredRealtimAlerts);
        renderAlertsRealtime(filteredRealtimAlerts);
    } catch (error) {
        console.error("Lỗi khi tải cảnh báo thời gian thực:", error);
    }
}
// Tìm kiếm cảnh báo theo khoảng thời gian
async function searchAlertsByDateRange(startDate, endDate, role_id) {
    try {
        const response = await fetch(`${API_URL}?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let allAlerts = await response.json();

        // Hàm helper để lọc theo role_id
        const filterByRole = (alerts, includeTimeFilter = false) => {
            let filtered = alerts;

            // Lọc theo role_id
            if (role_id === 2) {
                filtered = filtered.filter(alert =>
                    alert.sensor_id?.startsWith("Lab001")
                );
            } else if (role_id === 3) {
                filtered = filtered.filter(alert =>
                    alert.sensor_id?.startsWith("A4002")
                );
            }

            // Lọc thêm theo thời gian nếu cần
            if (includeTimeFilter) {
                filtered = filtered.filter(alert =>
                    new Date(alert.created_at) >= twoMinutesAgo
                );
            }

            return filtered;
        };

        // Lọc cảnh báo cho bảng chính (không giới hạn thời gian)
        const filteredAlerts = filterByRole(allAlerts);
        console.log("Cảnh báo tìm kiếm:", filteredAlerts);
        renderAlerts(filteredAlerts);

        // Lọc cảnh báo realtime (2 phút gần nhất)
        const realtimeAlerts = filterByRole(allAlerts, true);
        console.log("Cảnh báo realtime:", realtimeAlerts);
        renderAlertsRealtime(realtimeAlerts);

    } catch (error) {
        console.error("Lỗi khi tìm kiếm cảnh báo:", error);
        // Có thể thêm hiển thị thông báo lỗi cho người dùng ở đây
        alert("Có lỗi xảy ra khi tải cảnh báo. Vui lòng thử lại.");
    }
}

// Hiển thị cảnh báo trong bảng
function renderAlerts(alerts) {
    const alertTableBody = document.getElementById("alert-table-body");
    if (alertTableBody) {
        alertTableBody.innerHTML = alerts
            .map(alert => `
                <tr>
                    <td>${alert.sensor_id || "N/A"}</td>
                    <td>${alert.alert_type}</td>
                    <td>${alert.severity}</td>
                    <td>${alert.message}</td>
                    <td>${new Date(alert.created_at).toLocaleString()}</td>
                </tr>
            `)
            .join("");
    }
}
// Hiển thị cảnh báo realtime
function renderAlertsRealtime(alerts) {
    const tbody = document.getElementById("alert-table-realtime-body");
    if (!tbody) {
        console.error("Không tìm thấy bảng realtime alerts");
        return;
    }

    alerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tbody.innerHTML = alerts.slice(0, 10).map(alert => `
        <tr class="new-alert">
            <td>${alert.sensor_id || "N/A"}</td>
            <td>${alert.alert_type || "N/A"}</td>
            <td class="alert-${alert.severity.toLowerCase()}">${alert.severity || "N/A"}</td>
            <td>${alert.message || "N/A"}</td>
            <td>${new Date(alert.created_at).toLocaleString()}</td>
        </tr>
    `).join("");
}
// Sự kiện tìm kiếm
document.getElementById("search-button").addEventListener("click", () => {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // Lấy role_id từ localStorage
    const user = JSON.parse(localStorage.getItem("user"));
    const role_id = user.role_id;

    if (!startDate || !endDate) {
        alert("Vui lòng chọn cả ngày bắt đầu và ngày kết thúc.");
        return;
    }

    if (startDate > endDate) {
        alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        return;
    }

    searchAlertsByDateRange(startDate, endDate, role_id);
});
function formatDateForMySQL(date) {
    const pad = (num) => num.toString().padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}