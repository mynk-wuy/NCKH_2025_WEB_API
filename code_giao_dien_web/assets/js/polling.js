// polling.js - Phiên bản real-time
const REAL_TIME_API = "http://localhost/routes/realtime_alerts.php";
let lastAlertId = null;

window.alertPolling = {
  init: function() {
    this.checkRealTimeAlerts();
    this.interval = setInterval(() => this.checkRealTimeAlerts(), 5000); // 5 giây
  },

  checkRealTimeAlerts: async function() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;
    
    try {
      const response = await fetch(`${REAL_TIME_API}?last_id=${lastAlertId || ''}`);
      const alerts = await response.json();
      
      if (alerts.length > 0) {
        lastAlertId = alerts[0].id; // Cập nhật ID mới nhất
        this.processRealTimeAlerts(alerts, user.role_id);
      }
    } catch (error) {
      console.error("Real-time alert error:", error);
    }
  },

  processRealTimeAlerts: function(alerts, role_id) {
    const now = new Date();
    
    alerts.forEach(alert => {
      // Tính thời gian chênh lệch so với hiện tại (đơn vị: giây)
      const alertTime = new Date(alert.created_at);
      const diffSeconds = Math.floor((now - alertTime) / 1000);
      
      // Chỉ hiển thị cảnh báo không quá 30 giây trước
      if (diffSeconds <= 30 && this.checkAlertPermission(alert, role_id)) {
        this.showRealTimeAlert(alert, diffSeconds);
      }
    });
  },

  showRealTimeAlert: function(alert, diffSeconds) {
    const timeText = diffSeconds < 5 ? "Vừa xảy ra" : `${diffSeconds} giây trước`;
    
    const toast = document.createElement("div");
    toast.className = `realtime-toast ${alert.severity.toLowerCase()}`;
    toast.innerHTML = `
      <div class="realtime-header">
        <span class="realtime-time">${timeText}</span>
        <span class="realtime-close">&times;</span>
      </div>
      <div class="realtime-content">
        <strong>${alert.alert_type}</strong>
        <p>${alert.message}</p>
        <small>${new Date(alert.created_at).toLocaleTimeString()}</small>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Tự động ẩn sau 10 giây
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 500);
    }, 10000);
    
    // Đóng thủ công
    toast.querySelector(".realtime-close").onclick = () => toast.remove();
  }
};

// Khởi động
document.addEventListener("DOMContentLoaded", () => {
  window.alertPolling.init();
});