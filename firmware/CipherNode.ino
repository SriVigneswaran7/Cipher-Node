#include <Servo.h>

// --- Configuration ---
const int SECRET_CODE[] = {4, 0, 4}; // The combination
const int CODE_LENGTH = 3;

// --- Pins ---
const int BTN_CYCLE = 2;
const int BTN_ENTER = 3;
const int LED_RED = 8;
const int LED_GREEN = 9;
const int SERVO_PIN = 10;

// --- State Variables ---
Servo lockServo;
int currentDigit = 0;
int enteredCode[3];
int attemptIndex = 0;
bool isLocked = true;

void setup() {
  Serial.begin(9600);
  
  pinMode(BTN_CYCLE, INPUT_PULLUP);
  pinMode(BTN_ENTER, INPUT_PULLUP);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  
  lockServo.attach(SERVO_PIN);
  updateHardware(true); // Start locked
  
  // Initial Telemetry
  Serial.println("{\"event\": \"system_boot\", \"status\": \"ready\"}");
}

void loop() {
  // Check for Remote Override from Python (Phase 3 Prep)
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'U') handleSuccess(); // 'U' for Unlock
    if (cmd == 'L') updateHardware(true); // 'L' for Lock
  }

  // Physical Button Logic
  if (digitalRead(BTN_CYCLE) == LOW) {
    currentDigit = (currentDigit + 1) % 10;
    
    // Telemetry: Current selection
    Serial.print("{\"event\": \"digit_cycle\", \"value\": ");
    Serial.print(currentDigit);
    Serial.println("}");
    
    delay(250); // Debounce
  }

  if (digitalRead(BTN_ENTER) == LOW) {
    enteredCode[attemptIndex] = currentDigit;
    attemptIndex++;

    Serial.print("{\"event\": \"digit_entry\", \"index\": ");
    Serial.print(attemptIndex);
    Serial.println("}");

    if (attemptIndex >= CODE_LENGTH) {
      checkCode();
    }
    
    currentDigit = 0; // Reset digit for next position
    delay(250); // Debounce
  }
}

void checkCode() {
  bool match = true;
  for (int i = 0; i < CODE_LENGTH; i++) {
    if (enteredCode[i] != SECRET_CODE[i]) match = false;
  }

  if (match) {
    handleSuccess();
  } else {
    handleFailure();
  }
  attemptIndex = 0;
}

void handleSuccess() {
  updateHardware(false);
  Serial.println("{\"event\": \"access_granted\", \"status\": \"unlocked\"}");
}

void handleFailure() {
  updateHardware(true);
  Serial.println("{\"event\": \"access_denied\", \"status\": \"locked\"}");
  // Flash red to show failure
  for(int i=0; i<3; i++) {
    digitalWrite(LED_RED, LOW); delay(100);
    digitalWrite(LED_RED, HIGH); delay(100);
  }
}

void updateHardware(bool locked) {
  isLocked = locked;
  if (locked) {
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
    lockServo.write(0);
  } else {
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, HIGH);
    lockServo.write(90);
  }
}