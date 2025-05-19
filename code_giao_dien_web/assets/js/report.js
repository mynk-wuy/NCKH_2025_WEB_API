import { initializeMQTT, fetchThresholds } from "../js/hamcanhbao.js";
document.addEventListener("DOMContentLoaded", async function () {
    const user = JSON.parse(localStorage.getItem("user"));
    const role_id = user.role_id;
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    await fetchThresholds(); // Lấy ngưỡng cảm biến từ API
    initializeMQTT(); // Khởi tạo MQTT
    displayUserRole(user.role_id);
    handleUserRole(user.role_id);
    // Khởi tạo biểu đồ
    initializeCharts();
    const stationSelect = document.getElementById('station-select');
    while (stationSelect.options.length > 0) {
        stationSelect.remove(0);
    }
    if (role_id === 2) {
        // Nếu role_id = 2, chỉ hiển thị Trạm 1
        addOption(stationSelect, "station1", "Trạm 1");
    } else if (role_id === 3) {
        addOption(stationSelect, "station2", "Trạm 2");
    } else {
        // Các role_id khác, hiển thị tất cả các option
        addOption(stationSelect, "all", "Tất cả");
        addOption(stationSelect, "station1", "Trạm 1");
        addOption(stationSelect, "station2", "Trạm 2");
    }
});
// Hàm trợ giúp để thêm option vào select
function addOption(selectElement, value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    selectElement.appendChild(option);
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
    roleElement.classList.add("roboto-custom"); // Áp dụng font Roboto
}

// Phân quyền
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
        item.classList.add("roboto-custom"); // Áp dụng font Roboto
    });
}

const API_URL = "http://localhost/routes/getReport.php";
let charts = []; // Mảng lưu trữ các biểu đồ đường

// Khởi tạo biểu đồ
function initializeCharts() {
    charts = [];
}

// Tải dữ liệu cảm biến
async function loadData() {
    const user = JSON.parse(localStorage.getItem("user"));
    const role_id = user.role_id;
    const timeRange = document.getElementById("time-range").value;
    const station = document.getElementById('station-select').value;
    const sensorType = document.getElementById("sensor-select").value;

    console.log("Trạm:", station);
    // Xóa tất cả các option hiện tại

    try {
        const response = await fetch(`${API_URL}?time_range=${timeRange}&sensor_type=${sensorType}`);
        let allData = await response.json();

        // Lọc dữ liệu theo role_id
        let filteredData;
        if (role_id === 2) {
            // Nếu role_id = 2, chỉ hiển thị Trạm 1
            filteredData = allData.filter(data => data.sensor_id.startsWith("Lab001"));
        } else if (role_id === 3) {
            filteredData = allData.filter(data => data.sensor_id.startsWith("A4002"));
        } else {
            if (station === "station1") {
                filteredData = allData.filter(data => data.sensor_id.startsWith("Lab001"));
            } else if (station === "station2") {
                filteredData = allData.filter(data => data.sensor_id.startsWith("A4002"));

            } else {
                filteredData = allData;
            }
        }

        // Cập nhật biểu đồ và bảng thống kê
        updateCharts(filteredData);
        updateStatsTable(filteredData);
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        alert("Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.");
    }
    // Tải dữ liệu cảnh báo
    const alertData = await fetchAlertData();
    // Hiển thị dữ liệu cảnh báo
    displayAlertData(alertData);


}

// Cập nhật biểu đồ
function updateCharts(data) {
    const container = document.getElementById("line-charts-container");
    container.innerHTML = ""; // Xóa các biểu đồ cũ
    charts = []; // Xóa mảng biểu đồ cũ

    // Lấy danh sách cảm biến duy nhất
    const sensors = [...new Set(data.map(item => item.sensor_id))];

    // Tạo biểu đồ đường cho từng cảm biến
    sensors.forEach((sensor, index) => {
        const sensorData = data.filter(item => item.sensor_id === sensor);
        const labels = sensorData.map(item => new Date(item.recorded_at).toLocaleString());
        const values = sensorData.map(item => item.value);

        // Tạo wrapper cho biểu đồ
        const chartWrapper = document.createElement("div");
        chartWrapper.className = "chart-wrapper";

        // Tạo tiêu đề cho biểu đồ
        const chartTitle = document.createElement("h3");
        chartTitle.textContent = `Biểu đồ ${sensor}`;
        chartTitle.classList.add("roboto-custom"); // Áp dụng font Roboto
        chartWrapper.appendChild(chartTitle);

        // Tạo canvas cho biểu đồ
        const canvas = document.createElement("canvas");
        canvas.id = `lineChart-${index}`;
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        // Tạo biểu đồ đường
        const ctx = canvas.getContext("2d");
        const newChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: sensor,
                    data: values,
                    borderColor: getRandomColor(),
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3,

                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Thời gian",
                            font: { family: "Roboto", size: 14 } // Sử dụng font Roboto
                        },
                        ticks: {
                            font: { family: "Roboto" } // Font cho nhãn trục x
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Giá trị (ppm)",
                            font: { family: "Roboto", size: 14 } // Sử dụng font Roboto
                        },
                        ticks: {
                            font: { family: "Roboto" } // Font cho nhãn trục y
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            font: { family: "Roboto" } // Font cho chú thích
                        }
                    },
                    zoom: {
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: "xy"
                        }
                    }
                }
            }
        });

        charts.push(newChart); // Lưu biểu đồ vào mảng
    });
}

// Cập nhật bảng thống kê
function updateStatsTable(data) {
    const sensors = [...new Set(data.map(item => item.sensor_id))];
    const tbody = document.querySelector("#statsTable tbody");
    tbody.innerHTML = "";

    sensors.forEach(sensor => {
        const sensorData = data.filter(item => item.sensor_id === sensor);
        const values = sensorData.map(item => parseFloat(item.value));
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length || 0;
        const max = Math.max(...values) || 0;
        const min = Math.min(...values) || 0;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${sensor}</td>
            <td>${avg.toFixed(2)}</td>
            <td>${max.toFixed(2)}</td>
            <td>${min.toFixed(2)}</td>
        `;
        row.classList.add("roboto-custom"); // Áp dụng font Roboto
        tbody.appendChild(row);
    });
}

// Tạo màu ngẫu nhiên cho biểu đồ
function getRandomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}



// Hàm lấy dữ liệu cảnh báo
async function fetchAlertData() {
    const time_range = document.getElementById('time-range').value;
    const sensor_type = document.getElementById('sensor-select').value;

    try {
        // Xây dựng URL với các tham số
        let url = 'http://localhost/routes/getAlert_To_Report.php';
        const params = new URLSearchParams();

        // Thêm tham số thời gian
        params.append('time_range', time_range);

        // Thêm tham số cảm biến nếu không phải "all"
        if (sensor_type !== 'all') {
            params.append('sensor_type', sensor_type);
        }
        //hiện thị params lên console
        console.log('Tham số gửi đi:', params.toString());
        const response = await fetch(`${url}?${params.toString()}`);


        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        //hiện thị dữ liệu lên console
        console.log('Dữ liệu cảnh báo:', data);
        //hiện thị time range và sensor type lên console
        console.log('Thời gian:', time_range);
        console.log('Loại cảm biến:', sensor_type);
        return data;
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu cảnh báo:', error);
        return [];
    }

}

// Sửa hàm hiển thị dữ liệu cảnh báo
function displayAlertData(alertData) {
    const tableBody = document.querySelector('#alertsTable tbody');
    tableBody.innerHTML = ''; // Xóa dữ liệu cũ

    if (!alertData || alertData.length === 0) {
        // Nếu không có dữ liệu cảnh báo
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'Không có dữ liệu cảnh báo trong khoảng thời gian này';
        cell.classList.add('roboto-custom', 'text-center');
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    // Thêm dữ liệu cảnh báo vào bảng
    alertData.forEach(alert => {
        const row = document.createElement('tr');

        // Tạo các ô dữ liệu
        const cells = [
            alert.sensor_id || 'N/A',
            alert.alert_type || 'N/A',
            alert.severity || 'N/A',
            alert.message || 'N/A',
            alert.created_at || 'N/A'
        ];

        cells.forEach((cellText, index) => {
            const cell = document.createElement('td');
            cell.textContent = cellText;
            cell.classList.add('roboto-custom');

            // Thêm màu cho mức độ cảnh báo (cột thứ 3)
            if (index === 2 && cellText && typeof cellText === 'string') {
                const level = cellText.toLowerCase();
                if (level === 'high') {
                    cell.classList.add('alert-high');
                } else if (level === 'medium') {
                    cell.classList.add('alert-medium');
                } else if (level === 'low') {
                    cell.classList.add('alert-low');
                }
            }

            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });
}

// Sửa hàm exportToPDF để đảm bảo xử lý an toàn với dữ liệu cảnh báo
function exportToPDF() {
    // Lấy thông tin từ form
    const userName = document.getElementById("user-name").value || "Không xác định";
    const userRole = document.getElementById("user-role").textContent || "Không xác định";
    const timeRange = document.getElementById("time-range").options[document.getElementById("time-range").selectedIndex].text;
    const sensorType = document.getElementById("sensor-select").options[document.getElementById("sensor-select").selectedIndex].text;
    const currentDate = new Date().toLocaleDateString('vi-VN');

    // Tạo nội dung PDF
    const docDefinition = {
        pageSize: "A4",
        pageOrientation: "portrait",
        pageMargins: [40, 60, 40, 60], // Lề trang: [trái, trên, phải, dưới]
        footer: function (currentPage, pageCount) {
            return {
                text: `Trang ${currentPage} / ${pageCount}`,
                alignment: 'center',
                fontSize: 10
            };
        },
        content: [
            { text: "BÁO CÁO DỮ LIỆU CẢM BIẾN", style: "header", alignment: "center" },
            { text: `Ngày lập báo cáo: ${currentDate}`, style: "subheader", margin: [0, 20, 0, 0] },
            { text: `Người lập báo cáo: ${userName}`, style: "subheader", margin: [0, 5, 0, 0] },
            { text: `${userRole}`, style: "subheader", margin: [0, 5, 0, 0] },
            { text: `Thời gian: ${timeRange}`, style: "subheader", margin: [0, 5, 0, 0] },
            { text: `Loại cảm biến: ${sensorType}`, style: "subheader", margin: [0, 5, 0, 20] }
        ],
        styles: {
            header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
            subheader: { fontSize: 12 },
            chartTitle: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
            tableHeader: { fontSize: 12, bold: true, alignment: 'center', fillColor: '#eeeeee' },
            tableCell: { fontSize: 11 },
            section: { fontSize: 16, bold: true, margin: [0, 15, 0, 10] }
        },
        defaultStyle: {
            font: "Roboto"
        }
    };

    // Thêm phần thống kê dữ liệu
    docDefinition.content.push(
        { text: "THỐNG KÊ DỮ LIỆU CẢM BIẾN", style: "section", margin: [0, 10, 0, 10] }
    );

    // Thêm bảng thống kê
    const statsTableBody = [
        [
            { text: "Cảm biến", style: "tableHeader" },
            { text: "Trung bình (ppm)", style: "tableHeader" },
            { text: "Tối đa (ppm)", style: "tableHeader" },
            { text: "Tối thiểu (ppm)", style: "tableHeader" }
        ]
    ];

    // Lấy dữ liệu từ bảng thống kê
    Array.from(document.querySelectorAll("#statsTable tbody tr")).forEach(row => {
        const rowData = Array.from(row.cells).map(cell => {
            return { text: cell.textContent, style: "tableCell" };
        });
        statsTableBody.push(rowData);
    });

    // Thêm bảng thống kê vào PDF
    docDefinition.content.push({
        table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: statsTableBody
        },
        margin: [0, 0, 0, 20]
    });

    // Thêm phần các biểu đồ
    docDefinition.content.push(
        { text: "BIỂU ĐỒ DỮ LIỆU", style: "section", margin: [0, 10, 0, 10] }
    );

    // Thêm các biểu đồ đường
    const chartPromises = charts.map((chart, index) => {
        return new Promise((resolve) => {
            const canvas = document.getElementById(`lineChart-${index}`);

            // Đảm bảo canvas đã render đầy đủ
            setTimeout(() => {
                const chartDataURL = canvas.toDataURL("image/png", 1.0);
                resolve({
                    title: chart.data.datasets[0].label,
                    dataURL: chartDataURL
                });
            }, 100);
        });
    });

    // Xử lý tất cả các biểu đồ
    Promise.all(chartPromises).then(chartImages => {
        // Thêm từng biểu đồ vào PDF
        chartImages.forEach(chart => {
            docDefinition.content.push(
                { text: `Biểu đồ ${chart.title}`, style: "chartTitle", alignment: "center" },
                { image: chart.dataURL, width: 510, alignment: "center", margin: [0, 0, 0, 20] }
            );
        });

        // Thêm phần cảnh báo nếu có
        const alertTableBody = document.querySelector("#alertsTable tbody");
        if (alertTableBody && alertTableBody.rows.length > 0) {
            docDefinition.content.push(
                { text: "CẢNH BÁO", style: "section", margin: [0, 10, 0, 10] }
            );

            const alertData = [
                [
                    { text: "Cảm biến", style: "tableHeader" },
                    { text: "Loại cảnh báo", style: "tableHeader" },
                    { text: "Mức độ", style: "tableHeader" },
                    { text: "Chi tiết", style: "tableHeader" },
                    { text: "Thời gian", style: "tableHeader" }
                ]
            ];

            // Kiểm tra xem có phải bảng "không có dữ liệu" không
            const firstRow = alertTableBody.rows[0];
            const isNoDataRow = firstRow && firstRow.cells.length === 1;

            if (!isNoDataRow) {
                // Lấy dữ liệu từ bảng cảnh báo
                Array.from(alertTableBody.rows).forEach(row => {
                    const rowData = Array.from(row.cells).map((cell, index) => {
                        const cellStyle = { text: cell.textContent || 'N/A', style: "tableCell" };

                        // Tô màu cho cột mức độ cảnh báo
                        if (index === 2 && cell.textContent && typeof cell.textContent === 'string') {
                            const level = cell.textContent.toLowerCase();
                            if (level === 'high') {
                                cellStyle.fillColor = '#ffcccc';
                            } else if (level === 'medium') {
                                cellStyle.fillColor = '#fff2cc';
                            } else if (level === 'low') {
                                cellStyle.fillColor = '#e6f2ff';
                            }
                        }

                        return cellStyle;
                    });
                    alertData.push(rowData);
                });
            }

            // Thêm bảng cảnh báo vào PDF nếu có dữ liệu
            if (alertData.length > 1 && !isNoDataRow) {
                docDefinition.content.push({
                    table: {
                        headerRows: 1,
                        widths: ['auto', 'auto', 'auto', '*', 'auto'],
                        body: alertData
                    },
                    margin: [0, 0, 0, 20]
                });
            } else {
                docDefinition.content.push({
                    text: "Không có cảnh báo trong khoảng thời gian này",
                    alignment: "center",
                    margin: [0, 10, 0, 20],
                    italics: true
                });
            }
        }

        // Thêm chữ ký người lập báo cáo
        docDefinition.content.push(
            { text: "Người lập báo cáo", alignment: "right", margin: [0, 30, 50, 50] },
            { text: userName, alignment: "right", margin: [0, 0, 50, 0] }
        );

        // Tạo và tải PDF
        try {
            const fileName = `BaoCao_${new Date().toISOString().split("T")[0]}.pdf`;
            pdfMake.createPdf(docDefinition).download(fileName);
        } catch (error) {
            console.error("Lỗi khi tạo PDF:", error);
            alert("Đã xảy ra lỗi khi tạo PDF. Vui lòng thử lại sau.");
        }
    }).catch(error => {
        console.error("Lỗi khi xử lý biểu đồ:", error);
        alert("Đã xảy ra lỗi khi xử lý biểu đồ. Vui lòng thử lại sau.");
    });
}
window.exportToPDF = exportToPDF; // Đảm bảo hàm có thể được gọi từ HTML
window.loadData = loadData; // Đảm bảo hàm có thể được gọi từ HTML
window.displayAlertData = displayAlertData; // Đảm bảo hàm có thể được gọi từ HTML
window.fetchAlertData = fetchAlertData; // Đảm bảo hàm có thể được gọi từ HTML