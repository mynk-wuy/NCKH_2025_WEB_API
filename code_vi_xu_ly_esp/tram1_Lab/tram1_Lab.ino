#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <LiquidCrystal_I2C.h>
#include <SimpleKalmanFilter.h>

// Thông tin Wi-Fi
const char* ssid = "Manh";
const char* password = "manhnguyen09";

const char* mqtt_server = "fd553ba641bf43729bad8a7af8400930.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_username = "NCKH2025";
const char* mqtt_password = "Manh09092003";

// Pin definitions
#define CO_SENSOR_PIN 34
#define H2_SENSOR_PIN 35
#define NH3_SENSOR_PIN 32
#define FAN_PIN 26  // Pin điều khiển quạt
#define LED_PIN 27  // Pin điều khiển LED
#define FAN_BUTTON 19
#define LED_BUTTON 18

// Các ngưỡng cảnh báo (PPM)
#define CO_THRESHOLD 1000   // Ngưỡng CO nguy hiểm (ppm)
#define H2_THRESHOLD 1000  // Ngưỡng H2 nguy hiểm (ppm)
#define NH3_THRESHOLD 1000  // Ngưỡng NH3 nguy hiểm (ppm)

// Hằng số hiệu chỉnh (đo thực tế hoặc từ datasheet)
const float RL = 10.0;      // Điện trở tải (kΩ)
const float VCC = 5.0;      // Điện áp nguồn (5V cho MQ series)
const float RO_CO = 10.0;   // Rs trong không khí sạch (kΩ) cho MQ-7
const float RO_H2 = 2.0;    // Rs trong không khí sạch (kΩ) cho MQ-8
const float RO_NH3 = 30.0;  // Rs trong không khí sạch (kΩ) cho MQ-135


// Các topic MQTT
const char* fanControlTopic = "Lab001/fan/control";
const char* ledControlTopic = "Lab001/led/control";
const char* fanStatusTopic = "Lab001/fan/status";
const char* ledStatusTopic = "Lab001/led/status";
const char* sensorDataTopic = "Lab001/sensors/data";  // Topic cho dữ liệu cảm biến
const char* modeTopic = "Lab001/mode/control";
// Thời gian giữa các lần đọc cảm biến (ms)
const unsigned long SENSOR_READ_INTERVAL = 10000;  // 10 giây
unsigned long lastSensorReadTime = 0;

// Timer interrupt
hw_timer_t* timer = NULL;
volatile bool timerFlag = false;

void IRAM_ATTR onTimer() {
  timerFlag = true;
}

// Khởi tạo các đối tượng
WiFiClientSecure espClient;
PubSubClient client(espClient);
bool fanState = false;
bool ledState = false;
bool Mode_Manu = false;
// Khai báo hàm trước setup()

void connectWiFi();
void callback(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void checkThresholdsAndAct(float co, float h2, float nh3);
void publishSensorData(float co, float h2, float nh3);

int lcdColumns = 16;
int lcdRows = 2;
LiquidCrystal_I2C lcd(0x27, lcdColumns, lcdRows);
#define THRESHOLD 100  // Ngưỡng thay đổi tối đa giữa các lần đọc
SimpleKalmanFilter simpleKalmanFilter(2, 2, 0.001);
void setup() {
  Serial.begin(115200);

  // initialize LCD
  lcd.init();
  // turn on LCD backlight
  lcd.backlight();
  // Khởi tạo bộ đếm thời gian với API mới
  timer = timerBegin(1000);  // Sử dụng tần số 1000Hz

  // Gắn hàm ngắt
  timerAttachInterrupt(timer, &onTimer);

  // Thiết lập báo thức 5 giây
  timerAlarm(timer, 5000, true, 5000);  // 5000ms = 5 seconds, true = auto reload, 5000 = reload value

  // Khởi tạo các pin
  pinMode(FAN_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_BUTTON, INPUT);
  pinMode(LED_BUTTON, INPUT);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Kết nối WiFi và MQTT
  connectWiFi();
  espClient.setInsecure();  // Cho phép kết nối mà không xác thực chứng chỉ

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  reconnectMQTT();

  // Gửi trạng thái ban đầu
  client.publish(fanStatusTopic, "OFF", true);
  client.publish(ledStatusTopic, "OFF", true);

  Serial.println("Hệ thống giám sát khí đã khởi động!");
}

void loop() {
  // Kiểm tra kết nối
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFi();
  }

  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  unsigned long currentMillis = millis();

  // Đọc giá trị cảm biến theo chu kỳ
  if (currentMillis - lastSensorReadTime >= SENSOR_READ_INTERVAL || timerFlag) {
    lastSensorReadTime = currentMillis;
    timerFlag = false;

    // Đọc giá trị cảm biến
    int coRaw = analogRead(CO_SENSOR_PIN);
    int h2Raw = analogRead(H2_SENSOR_PIN);
    int nh3Raw = analogRead(NH3_SENSOR_PIN);
    // In thông tin debug
    Serial.println("0-4095:");
    Serial.println("CO:" + String(coRaw));
    Serial.println("H2: " + String(h2Raw));
    Serial.println("NH3: " + String(nh3Raw));
    // Tính PPM dựa trên datasheet
    // float coPPM = calculatePPM(coRaw, RO_CO, -0.42, 1.29);   // MQ-7
    // float h2PPM = calculatePPM(h2Raw, RO_H2, -0.35, 1.05);   // MQ-8
    // float nh3PPM = calculatePPM(nh3Raw, RO_NH3, -0.47, 1.35); // MQ-135
    
        // In thông tin debug
   
    float coPPM = map(coRaw, 0, 4095, 10, 1000);
    float h2PPM = map(h2Raw, 0, 4095, 100, 10000);
    float nh3PPM = map(nh3Raw, 0, 4095, 10, 1000);
    //giá trị cảm bien map chua loc
    // Lọc tín hiệu bằng bộ lọc Kalman
    float COPPM = simpleKalmanFilter.updateEstimate(coPPM);    // MQ-7
    float H2PPM = simpleKalmanFilter.updateEstimate(h2PPM);    // MQ-8
    float NH3PPM = simpleKalmanFilter.updateEstimate(nh3PPM);  // MQ-135
    Serial.println("Đọc giá trị cảm biến đã lọc:");
    Serial.println("CO:" + String(COPPM) + "PPM");
    Serial.println("H2: " + String(COPPM) + " PPM");
    Serial.println("NH3: " + String(NH3PPM) + " PPM");

    Serial.println("Đọc giá trị cảm biến đã chuyển:");

    Serial.println("CO:" + String(coPPM) + "PPM");
    Serial.println("H2: " + String(h2PPM) + " PPM");
    Serial.println("NH3: " + String(nh3PPM) + " PPM");
    Serial.print(coPPM);
    Serial.print(",");
    Serial.println(h2PPM);
    Serial.print(",");
    Serial.println(nh3PPM);
    
    // Chuyển đổi sang kiểu int
    int coPPMInt = (int)COPPM;
    int h2PPMInt = (int)H2PPM;
    int nh3PPMInt = (int)NH3PPM;


    // Hiển thị lên LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("CO:" + String(coPPMInt) + " H2:" + String(h2PPMInt));
    lcd.setCursor(0, 1);
    lcd.print("NH3:" + String(nh3PPMInt) + "  dvi:PPM");

    // Gửi dữ liệu qua MQTT
    publishSensorData(COPPM, H2PPM, NH3PPM);
    if (Mode_Manu == false) {
      // Kiểm tra ngưỡng và xử lý
      checkThresholdsAndAct(COPPM, H2PPM, NH3PPM);
    }
  }

  // Thêm độ trễ nhỏ để giảm tải CPU
  delay(100);
  // Kiểm tra nút nhấn vật lý để đảo trạng thái quạt và đèn LED
  static bool lastFanButtonState = HIGH;
  static bool lastLedButtonState = HIGH;
  bool currentFanButtonState = digitalRead(FAN_BUTTON);
  bool currentLedButtonState = digitalRead(LED_BUTTON);

  if (currentFanButtonState == LOW && lastFanButtonState == HIGH) {
    fanState = !fanState;
    digitalWrite(FAN_PIN, fanState ? HIGH : LOW);
    Serial.println(fanState ? "Quạt đã BẬT (vật lý)" : "Quạt đã TẮT (vật lý)");
    client.publish(fanStatusTopic, fanState ? "ON" : "OFF", true);
  }

  if (currentLedButtonState == LOW && lastLedButtonState == HIGH) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.println(ledState ? "Đèn LED đã BẬT (vật lý)" : "Đèn LED đã TẮT (vật lý)");
    client.publish(ledStatusTopic, ledState ? "ON" : "OFF", true);
  }

  lastFanButtonState = currentFanButtonState;
  lastLedButtonState = currentLedButtonState;

  delay(100);  // Tránh kiểm tra liên tục gây nhiễu
}

void connectWiFi() {
  Serial.println("Đang kết nối đến WiFi...");
  WiFi.begin(ssid, password);

  unsigned long startAttemptTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("Đã kết nối đến WiFi!");
    Serial.print("Địa chỉ IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("Không thể kết nối đến WiFi. Sẽ thử lại sau.");
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Đã nhận tin nhắn [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);
  if (String(topic) == modeTopic && message == "MANUAL") {
    Mode_Manu = true;
    Serial.println("mode MANU");
  }
  if (String(topic) == modeTopic && message == "AUTO") {
    Mode_Manu = false;
    Serial.println("mode AUTO");
  }
  if (String(topic) == fanControlTopic && Mode_Manu == true) {
    if (message == "ON") {
      digitalWrite(FAN_PIN, HIGH);
      fanState = true;
      Serial.println("Quạt đã BẬT");
    } else if (message == "OFF") {
      digitalWrite(FAN_PIN, LOW);
      fanState = false;
      Serial.println("Quạt đã TẮT");
    }
    client.publish(fanStatusTopic, fanState ? "ON" : "OFF", true);
  }

  if (String(topic) == ledControlTopic && Mode_Manu == true) {
    if (message == "ON") {
      digitalWrite(LED_PIN, HIGH);
      ledState = true;
      Serial.println("LED đã BẬT");
    } else if (message == "OFF") {
      digitalWrite(LED_PIN, LOW);
      ledState = false;
      Serial.println("LED đã TẮT");
    }
    client.publish(ledStatusTopic, ledState ? "ON" : "OFF", true);
  }
 
}

void reconnectMQTT() {
  int attempts = 0;
  while (!client.connected() && attempts < 3) {
    Serial.print("Đang kết nối tới MQTT...");
    String clientId = "ESP32_Client_";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("Đã kết nối.");

      // Đăng ký các topic
      client.subscribe(fanControlTopic);
      client.subscribe(ledControlTopic);
      client.subscribe(modeTopic);

      // Gửi trạng thái hiện tại
      client.publish(fanStatusTopic, fanState ? "ON" : "OFF", true);
      client.publish(ledStatusTopic, ledState ? "ON" : "OFF", true);
    } else {
      Serial.print("Thất bại, lỗi: ");
      Serial.print(client.state());
      Serial.println(" Thử lại sau 5 giây.");
      delay(1000);
      attempts++;
    }
  }
}

void checkThresholdsAndAct(float co, float h2, float nh3) {
  // Kiểm tra từng loại khí
  if (co > CO_THRESHOLD) {
    Serial.println("CẢNH BÁO: Mức CO vượt ngưỡng!");
    digitalWrite(FAN_PIN, HIGH);
    fanState = true;
    Serial.println("Quạt đã BẬT");
    digitalWrite(LED_PIN, HIGH);
    ledState = true;
    Serial.println("LED đã BẬT");
  }

  if (h2 > H2_THRESHOLD) {
    Serial.println("CẢNH BÁO: Mức H2 vượt ngưỡng!");
    digitalWrite(FAN_PIN, HIGH);
    fanState = true;
    Serial.println("Quạt đã BẬT");
    digitalWrite(LED_PIN, HIGH);
    ledState = true;
    Serial.println("LED đã BẬT");
  }

  if (nh3 > NH3_THRESHOLD) {
    Serial.println("CẢNH BÁO: Mức NH3 vượt ngưỡng!");
    digitalWrite(FAN_PIN, HIGH);
    fanState = true;
    Serial.println("Quạt đã BẬT");
    digitalWrite(LED_PIN, HIGH);
    ledState = true;
    Serial.println("LED đã BẬT");
  }
}

void publishSensorData(float co, float h2, float nh3) {
  // Tạo chuỗi JSON chỉ chứa dữ liệu 3 khí
  String jsonPayload = "{\"Lab001CO\":" + String(co) + ",\"Lab001H2\":" + String(h2) + ",\"Lab001NH3\":" + String(nh3) + "}";

  // Gửi lên MQTT
  if (client.publish(sensorDataTopic, jsonPayload.c_str())) {
    Serial.println("Đã gửi dữ liệu cảm biến: " + jsonPayload);
  } else {
    Serial.println("Lỗi khi gửi dữ liệu cảm biến");
  }
}