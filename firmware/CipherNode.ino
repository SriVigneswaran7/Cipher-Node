#include <Servo.h>

// Pin Map
const int BTN_1 = 2;      // Cycle / Input 1
const int BTN_2 = 3;      // Enter / Input 2
const int LED_RED = 8;
const int LED_GREEN = 9;
const int SERVO_PIN = 10;

// State Variables
Servo lockServo;
unsigned long lastHeartbeat = 0;
const unsigned long WATCHDOG_TIMEOUT = 5000; // 5 Seconds
bool isLocked = true;

void setup() {
  Serial.begin(9600);
  
  pinMode(BTN_1, INPUT_PULLUP);
  pinMode(BTN_2, INPUT_PULLUP);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  
  lockServo.attach(SERVO_PIN);
  
  // Initial State: Locked
  executeLock();
  lastHeartbeat = millis(); 
  
  Serial.println("{\"event\": \"node_boot\", \"status\": \"awaiting_brain\"}");
}

void loop() {
  unsigned long currentTime = millis();

  // 1. Watchdog Timer
  if (!isLocked && (currentTime - lastHeartbeat > WATCHDOG_TIMEOUT)) {
    executeLock();
    Serial.println("{\"event\": \"watchdog_trigger\", \"reason\": \"heartbeat_lost\"}");
  }

  // 2. Input Relay
  checkButton(BTN_1, "btn_1");
  checkButton(BTN_2, "btn_2");

  // 3. Command Parser
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    
    if (cmd == 'U') {
      executeUnlock();
      lastHeartbeat = millis();
    } 
    else if (cmd == 'L') {
      executeLock();
      lastHeartbeat = millis();
    } 
    else if (cmd == 'P') {
      // Secret 'Ping'
      lastHeartbeat = millis();
    }
  }
}

// Relays physical presses to Python with simple JSON events
void checkButton(int pin, String label) {
  if (digitalRead(pin) == LOW) {
    // Local Feedback
    digitalWrite(LED_RED, LOW); 
    delay(20); 
    digitalWrite(LED_RED, isLocked ? HIGH : LOW);

    // Send Event
    Serial.print("{\"event\": \"btn_press\", \"id\": \"");
    Serial.print(label);
    Serial.println("\"}");

    delay(250); // Simple debounce
  }
}

void executeLock() {
  isLocked = true;
  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_GREEN, LOW);
  lockServo.write(0);
}

void executeUnlock() {
  isLocked = false;
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, HIGH);
  lockServo.write(90);
}