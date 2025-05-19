import { initializeMQTT, fetchThresholds } from "./hamcanhbao.js";
// Khai báo biến toàn cục
let coValues = [], h2Values = [], nh3Values = [];
let timeLabels = [];
let chartUpdatePending = false;
const updateInterval = 5000; // Tăng lên 5 giây để giảm tải trên máy chủ
let timeWindow = 10 * 60 * 1000; // 10 phút
let currentChart = null;
let isRealtime = true; // Theo dõi chế độ xem: thời gian thực hoặc lịch sử
let lastFetchedEndTime = new Date(); // Thời điểm cuối cùng đã tải dữ liệu
let dragStartX = null;

// Sự kiện khi trang đã tải
document.addEventListener("DOMContentLoaded", async function () {


    // Kiểm tra xác thực người dùng
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        console.log("Người dùng chưa đăng nhập");
        window.location.href = "login.html";
        return;
    }

    // Hiển thị vai trò và khởi tạo giao diện
    displayUserRole(user.role_id);
    handleUserRole(user.role_id);
    initializeDateTime();
    initializeUI();

    // Thiết lập hệ thống cập nhật dữ liệu
    fetchSensorData();
    await fetchThresholds(); // Lấy ngưỡng cảm biến từ API
    initializeMQTT(); // Kết nối MQTT
    // Chỉ cập nhật khi đang ở chế độ thời gian thực
    setInterval(() => {
        if (isRealtime) {
            fetchSensorData();
        }
    }, updateInterval);
    // Khởi tạo biểu đồ dự đoán
    initPredictionChart();

    // Lấy dữ liệu dự đoán ban đầu
    fetchPredictions();

    // Cập nhật dữ liệu dự đoán mỗi 10 phút
    setInterval(fetchPredictions, 60 * 1000);
});

// Khởi tạo giao diện
function initializeUI() {
    // Tạo các phần tử trạng thái nếu chưa có
    if (!document.getElementById("api-status")) {
        const statusDiv = document.createElement("div");
        statusDiv.id = "api-status";
        statusDiv.className = "status-indicator";
        statusDiv.textContent = "Đang kết nối...";
        document.body.appendChild(statusDiv);
    }

    // Thêm nút trở về thời gian thực
    addRealTimeButton();

    // Khởi tạo biểu đồ rỗng
    initializeChart();
}

// Thêm nút trở về xem thời gian thực
function addRealTimeButton() {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;

    const controlDiv = document.createElement('div');
    controlDiv.style.textAlign = 'right';
    controlDiv.style.margin = '10px 0';

    const returnButton = document.createElement('button');
    returnButton.textContent = 'Trở về thời gian thực';
    returnButton.className = 'btn btn-primary realtime-btn'; // Thêm lớp realtime-btn
    returnButton.id = 'return-realtime';
    returnButton.style.display = 'none'; // Ban đầu ẩn đi

    returnButton.onclick = () => {
        isRealtime = true;
        fetchSensorData();
        returnButton.style.display = 'none';
        updateStatusIndicator("Đã chuyển về chế độ thời gian thực", "info");
    };

    controlDiv.appendChild(returnButton);
    chartContainer.insertBefore(controlDiv, chartContainer.firstChild);
}

// Hiển thị vai trò người dùng
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

// Xử lý quyền truy cập dựa trên vai trò
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

// Lấy dữ liệu cảm biến từ API
function fetchSensorData(startTime = null, endTime = null) {
    let now, tenMinutesAgo;

    if (startTime && endTime) {
        // Sử dụng phạm vi thời gian được chỉ định
        now = new Date(endTime);
        tenMinutesAgo = new Date(startTime);
    } else {
        // Sử dụng phạm vi thời gian mặc định (10 phút trước đến hiện tại)
        now = new Date();
        tenMinutesAgo = new Date(now - timeWindow);
        lastFetchedEndTime = now; // Cập nhật thời điểm cuối cùng được tải
    }

    // Chuyển đổi sang định dạng múi giờ Việt Nam
    const formatDateTime = (date) => {
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + ' ' +
            String(date.getHours()).padStart(2, '0') + ':' +
            String(date.getMinutes()).padStart(2, '0') + ':' +
            String(date.getSeconds()).padStart(2, '0');
    };

    const tenMinutesAgoStr = formatDateTime(tenMinutesAgo);
    const currentTimeStr = formatDateTime(now);

    console.log("Tải dữ liệu từ", tenMinutesAgoStr, "đến", currentTimeStr);

    const apiUrl = `http://localhost/routes/giamsat2.php?start_time=${encodeURIComponent(tenMinutesAgoStr)}&end_time=${encodeURIComponent(currentTimeStr)}`;

    // Đặt timeout để xử lý khi API không phản hồi
    const fetchTimeout = setTimeout(() => {
        updateStatusIndicator("Kết nối API bị timeout", "error");
    }, 8000);

    fetch(apiUrl)
        .then(response => {
            clearTimeout(fetchTimeout);
            if (!response.ok) {
                updateStatusIndicator(`Lỗi API: ${response.status}`, "error");
                throw new Error(`Lỗi kết nối mạng: ${response.status}`);
            }
            updateStatusIndicator("Đã nhận dữ liệu thành công", "success");
            return response.json();
        })
        .then(data => {
            if (!data || data.length === 0) {
                console.warn("Không có dữ liệu từ API");
                return;
            }

            // Xóa dữ liệu cũ
            coValues = [];
            h2Values = [];
            nh3Values = [];
            timeLabels = [];

            // Xử lý dữ liệu mới
            const sortedData = data.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

            sortedData.forEach(entry => {
                try {
                    const recorded_at = new Date(entry.recorded_at);
                    const timeStr = recorded_at.toLocaleTimeString();
                    const value = parseFloat(entry.value);
                    // console.log("recorded_at từ API:", entry.recorded_at);
                    if (isNaN(value)) {
                        console.warn("Giá trị không hợp lệ:", entry);
                        return;
                    }

                    if (entry.sensor_id === "Lab001CO") {
                        coValues.push(value);
                        timeLabels.push(timeStr);
                    } else if (entry.sensor_id === "Lab001H2") {
                        h2Values.push(value);
                    } else if (entry.sensor_id === "Lab001NH3") {
                        nh3Values.push(value);
                    }
                } catch (e) {
                    console.error("Lỗi xử lý dữ liệu:", e);
                }
            });

            // Cập nhật giao diện
            updateRealtimeValues();
            if (isRealtime) {
                updateStats();
            }
            updateChart();
        })
        .catch(error => {
            clearTimeout(fetchTimeout);
            console.error("Lỗi tìm nạp dữ liệu:", error);
            updateStatusIndicator(`Lỗi: ${error.message}`, "error");
        });
}

// Cập nhật chỉ báo trạng thái
function updateStatusIndicator(message, type = "info") {
    const statusElement = document.getElementById("api-status");
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = "status-indicator " + type;

    // Ẩn thông báo thành công sau 3 giây
    if (type === "success") {
        setTimeout(() => {
            statusElement.textContent = "";
            statusElement.className = "status-indicator";
        }, 3000);
    }
}

// Cập nhật giá trị thời gian thực
function updateRealtimeValues() {
    try {
        const coElement = document.getElementById("co-value");
        const h2Element = document.getElementById("h2-value");
        const nh3Element = document.getElementById("nh3-value");

        if (coElement) {
            coElement.textContent = coValues.length > 0 ? coValues[coValues.length - 1].toFixed(2) + " ppm" : "N/A";
            // Thêm màu sắc cảnh báo nếu vượt ngưỡng
            if (coValues.length > 0) {
                const value = coValues[coValues.length - 1];
                coElement.style.color = value > 500 ? "red" : value > 300 ? "orange" : "black";
            }
        }

        if (h2Element) {
            h2Element.textContent = h2Values.length > 0 ? h2Values[h2Values.length - 1].toFixed(2) + " ppm" : "N/A";
            if (h2Values.length > 0) {
                const value = h2Values[h2Values.length - 1];
                h2Element.style.color = value > 500 ? "red" : value > 350 ? "orange" : "black";
            }
        }

        if (nh3Element) {
            nh3Element.textContent = nh3Values.length > 0 ? nh3Values[nh3Values.length - 1].toFixed(2) + " ppm" : "N/A";
            if (nh3Values.length > 0) {
                const value = nh3Values[nh3Values.length - 1];
                nh3Element.style.color = value > 500 ? "red" : value > 300 ? "orange" : "black";
            }
        }
    } catch (e) {
        console.error("Lỗi khi cập nhật giá trị thời gian thực:", e);
    }
}

// Cập nhật thống kê
function updateStats() {
    try {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // Hàm format datetime theo múi giờ Việt Nam
        const formatDateTime = (date) => {
            return date.getFullYear() + '-' +
                String(date.getMonth() + 1).padStart(2, '0') + '-' +
                String(date.getDate()).padStart(2, '0') + ' ' +
                String(date.getHours()).padStart(2, '0') + ':' +
                String(date.getMinutes()).padStart(2, '0') + ':' +
                String(date.getSeconds()).padStart(2, '0');
        };

        const startTimeStr = formatDateTime(startOfDay);
        const endTimeStr = formatDateTime(endOfDay);

        const apiUrl = `http://localhost/routes/giamsat2.php?start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) throw new Error("Network response was not ok");
                return response.json();
            })
            .then(data => {
                const dailyData = { co: [], h2: [], nh3: [] };

                if (!data || data.length === 0) {
                    console.warn("Không có dữ liệu thống kê từ API");
                    return;
                }

                data.forEach(entry => {
                    const value = parseFloat(entry.value);
                    if (isNaN(value)) return;

                    if (entry.sensor_id === "Lab001CO") dailyData.co.push(value);
                    else if (entry.sensor_id === "Lab001H2") dailyData.h2.push(value);
                    else if (entry.sensor_id === "Lab001NH3") dailyData.nh3.push(value);
                });

                const stats = {
                    co: calculateStats(dailyData.co),
                    h2: calculateStats(dailyData.h2),
                    nh3: calculateStats(dailyData.nh3)
                };

                ["co", "h2", "nh3"].forEach(type => {
                    ["avg", "max", "min"].forEach(metric => {
                        const element = document.getElementById(`${type}-${metric}`);
                        if (element) {
                            element.textContent = stats[type][metric] !== null ? stats[type][metric] + " ppm" : 'N/A';
                            element.style.color = stats[type][metric] !== null ? "black" : "red";
                        }
                    });
                });
            })
            .catch(error => {
                console.error("Lỗi khi lấy dữ liệu thống kê:", error);
            });
    } catch (e) {
        console.error("Lỗi trong hàm updateStats:", e);
    }
}

// Tính toán các giá trị thống kê
function calculateStats(values) {
    if (!values || values.length === 0) return { avg: null, max: null, min: null };

    try {
        return {
            avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
            max: Math.max(...values).toFixed(2),
            min: Math.min(...values).toFixed(2)
        };
    } catch (e) {
        console.error("Lỗi khi tính toán thống kê:", e);
        return { avg: null, max: null, min: null };
    }
}

// Khởi tạo biểu đồ trống
function initializeChart() {
    try {
        const ctx = document.getElementById('combinedChart');
        if (!ctx) {
            console.error("Không tìm thấy phần tử biểu đồ");
            return;
        }

        currentChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'CO', data: [], borderColor: 'red', borderWidth: 2, pointRadius: 0.8, tension: 0.3, fill: false },
                    { label: 'H2', data: [], borderColor: 'blue', borderWidth: 2, pointRadius: 0.8, tension: 0.3, fill: false },
                    { label: 'NH3', data: [], borderColor: 'green', borderWidth: 2, pointRadius: 0.8, tension: 0.3, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 }, // Tắt animation để tăng hiệu suất
                scales: {
                    x: {
                        title: { text: 'Thời gian đo', display: true },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        title: { text: 'Nồng độ (ppm)', display: true },
                        beginAtZero: true,
                        suggestedMax: 100
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'top',
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                            onPanComplete: handleChartPan
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    }
                }
            },
            // plugins: [ChartDataLabels]
        });

        // Đăng ký sự kiện kéo thả trên biểu đồ
        setupChartDragEvents(ctx);
    } catch (e) {
        console.error("Lỗi khi khởi tạo biểu đồ:", e);
    }
}

// Thiết lập sự kiện kéo thả cho biểu đồ
function setupChartDragEvents(chartCanvas) {
    if (!chartCanvas) return;

    // Đăng ký sự kiện chuột
    chartCanvas.addEventListener('mousedown', function (event) {
        dragStartX = event.offsetX;
    });

    chartCanvas.addEventListener('mousemove', function (event) {
        if (dragStartX === null) return;

        // Hiển thị thông báo rằng đang trong chế độ kéo
        updateStatusIndicator("Đang kéo biểu đồ...", "info");

        // Hiển thị nút trở về thời gian thực
        document.getElementById('return-realtime').style.display = 'inline-block';
    });

    chartCanvas.addEventListener('mouseup', function (event) {
        if (dragStartX === null) return;

        const dragEndX = event.offsetX;
        const dragDistance = dragEndX - dragStartX;

        if (Math.abs(dragDistance) > 20) { // Chỉ xử lý nếu kéo đủ xa
            handleDrag(dragDistance);
        }

        dragStartX = null;
    });

    chartCanvas.addEventListener('mouseleave', function () {
        dragStartX = null;
    });
}

// Xử lý sự kiện kéo biểu đồ
function handleDrag(dragDistance) {
    // Đổi sang chế độ xem lịch sử nếu đang ở chế độ thời gian thực
    if (isRealtime) {
        isRealtime = false;
        // Hiển thị nút trở về thời gian thực
        document.getElementById('return-realtime').style.display = 'inline-block';
    }

    // Tính toán thời gian mới dựa trên khoảng cách kéo
    // Kéo sang trái (dragDistance < 0) = xem dữ liệu cũ hơn
    // Kéo sang phải (dragDistance > 0) = xem dữ liệu mới hơn

    // Tính toán tỷ lệ thời gian: Giả sử kéo toàn bộ chiều rộng biểu đồ = dịch chuyển toàn bộ khoảng thời gian
    const chartWidth = document.getElementById('combinedChart').clientWidth;
    const timeShift = Math.round((dragDistance / chartWidth) * timeWindow);

    let endTime = new Date(lastFetchedEndTime.getTime() - timeShift);
    let startTime = new Date(endTime.getTime() - timeWindow);

    // Kiểm tra xem đã vượt qua thời điểm hiện tại chưa
    const now = new Date();
    if (endTime > now) {
        endTime = now;
        startTime = new Date(now.getTime() - timeWindow);

        // Nếu đã quay lại thời điểm hiện tại, có thể chuyển về chế độ thời gian thực
        if (Math.abs(now - endTime) < 1000) { // Nếu chênh lệch ít hơn 1 giây
            isRealtime = true;
            document.getElementById('return-realtime').style.display = 'none';
            updateStatusIndicator("Đã chuyển về chế độ thời gian thực", "info");
        }
    }

    // Cập nhật biến theo dõi thời điểm cuối cùng được tải
    lastFetchedEndTime = endTime;

    // Tải dữ liệu mới
    fetchSensorData(startTime, endTime);
}

// Xử lý sự kiện pan hoàn tất (khi sử dụng plugin zoom của Chart.js)
function handleChartPan({ chart }) {
    isRealtime = false; // Chuyển sang chế độ xem lịch sử
    document.getElementById('return-realtime').style.display = 'inline-block';

    // Lấy phạm vi dữ liệu mới từ biểu đồ (nếu cần)
    // chart.scales.x.min và chart.scales.x.max
}

// Cập nhật biểu đồ
function updateChart() {
    try {
        if (chartUpdatePending) return;
        chartUpdatePending = true;

        requestAnimationFrame(() => {
            if (!currentChart) {
                initializeChart();
                chartUpdatePending = false;
                return;
            }

            // Cập nhật dữ liệu
            currentChart.data.labels = timeLabels;
            currentChart.data.datasets[0].data = coValues;
            currentChart.data.datasets[1].data = h2Values;
            currentChart.data.datasets[2].data = nh3Values;

            // Hạn chế số điểm hiển thị nếu quá nhiều
            const maxDataPoints = 30;
            if (timeLabels.length > maxDataPoints) {
                // Chỉ hiển thị mỗi maxDataPoints điểm để tránh quá tải
                const decimationFactor = Math.floor(timeLabels.length / maxDataPoints);
                if (decimationFactor > 1) {
                    currentChart.options.decimation = {
                        enabled: true,
                        algorithm: 'lttb',
                        samples: maxDataPoints
                    };
                }
            }

            currentChart.update('none'); // Cập nhật không cần animation
            chartUpdatePending = false;
        });
    } catch (e) {
        chartUpdatePending = false;
        console.error("Lỗi khi cập nhật biểu đồ:", e);
    }
}

// Khởi tạo hiển thị thời gian
function initializeDateTime() {
    try {
        updateDateTime(); // Cập nhật ngay lập tức
        setInterval(updateDateTime, 1000); // Cập nhật mỗi giây
    } catch (e) {
        console.error("Lỗi khi khởi tạo hiển thị thời gian:", e);
    }
}

// Cập nhật hiển thị thời gian
function updateDateTime() {
    const dateTimeElement = document.getElementById('datetime');
    if (dateTimeElement) {
        const now = new Date();
        dateTimeElement.textContent = now.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}
/// ----------------------- BIỂU ĐỒ DỰ ĐOÁN ------------------
let predictChart = null; // Khởi tạo biến chart

// Hàm khởi tạo biểu đồ dự đoán
function initPredictionChart() {
    try {
        const ctx = document.getElementById('predictChart');
        if (!ctx) {
            console.error('Không tìm thấy phần tử canvas cho biểu đồ dự đoán');
            return;
        }

        // Xóa biểu đồ cũ nếu tồn tại
        if (predictChart) {
            predictChart.destroy();
        }

        // Tạo biểu đồ mới
        predictChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'CO (dự đoán)',
                        data: [],
                        borderColor: 'red',
                        borderWidth: 2,
                        pointRadius: 0.8,
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'H2 (dự đoán)',
                        data: [],
                        borderColor: 'blue',
                        borderWidth: 2,
                        pointRadius: 0.8,
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'NH3 (dự đoán)',
                        data: [],
                        borderColor: 'green',
                        borderWidth: 2,
                        pointRadius: 0.8,
                        tension: 0.3,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ppm`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Thời gian'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Nồng độ (ppm)'
                        },
                        beginAtZero: false
                    }
                }
            }
        });
        
        console.log('Biểu đồ dự đoán đã được khởi tạo thành công');
    } catch (error) {
        console.error('Lỗi khi khởi tạo biểu đồ dự đoán:', error);
    }
}

// Hàm cập nhật biểu đồ dự đoán
function updatePredictionChart(apiData) {
    try {
        if (!apiData || !apiData.predictions) {
            console.error('Dữ liệu API không hợp lệ');
            return;
        }

        const { Lab001CO, Lab001H2, Lab001NH3 } = apiData.predictions;
        
        // Kiểm tra dữ liệu
        if (!Lab001CO || !Lab001H2 || !Lab001NH3 || 
            Lab001CO.length === 0 || Lab001H2.length === 0 || Lab001NH3.length === 0) {
            console.error('Thiếu dữ liệu cảm biến');
            return;
        }

        // Chuẩn bị dữ liệu
        const labels = Lab001CO.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        });

        const coData = Lab001CO.map(item => parseFloat(item.predicted_value));
        const h2Data = Lab001H2.map(item => parseFloat(item.predicted_value));
        const nh3Data = Lab001NH3.map(item => parseFloat(item.predicted_value));

        // Cập nhật biểu đồ
        if (!predictChart) {
            initPredictionChart(); // Khởi tạo nếu chưa có
        }

        predictChart.data.labels = labels;
        predictChart.data.datasets[0].data = coData;
        predictChart.data.datasets[1].data = h2Data;
        predictChart.data.datasets[2].data = nh3Data;
        
        // Tự động điều chỉnh trục Y
        predictChart.options.scales.y.min = Math.min(
            ...coData, ...h2Data, ...nh3Data
        ) * 0.9;
        predictChart.options.scales.y.max = Math.max(
            ...coData, ...h2Data, ...nh3Data
        ) * 1.1;

        predictChart.update();
        console.log('Biểu đồ dự đoán đã được cập nhật');

        // // Hiển thị thời gian cập nhật
        // const updateElement = document.getElementById('prediction-datetime');
        // if (updateElement) {
        //     updateElement.textContent = `Cập nhật lúc: ${new Date().toLocaleString('vi-VN')} | Dữ liệu đến: ${apiData.last_updated}`;
        // }
    } catch (error) {
        console.error('Lỗi khi cập nhật biểu đồ dự đoán:', error);
    }
}

// Hàm lấy dữ liệu dự đoán từ API
async function fetchPredictions() {
    try {
        const response = await fetch('http://127.0.0.1:3000/predict');
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);

        const data = await response.json();
        if (data.status !== 'success' || !data.predictions) {
            throw new Error('Dữ liệu không hợp lệ');
        }

        updatePredictionChart(data);
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu dự đoán:', error);
    }
}