#include <Servo.h>

// --- PIN DEFINITIONS ---
const int BUTTON_CYCLE_PIN = 2; // Button 1 (Top)
const int BUTTON_ENTER_PIN = 3; // Button 2 (Bottom)
const int LED_LOCKED_PIN = 8;   // Red LED
const int LED_UNLOCKED_PIN = 9; // Green LED
const int SERVO_PIN = 10;       // Servo Motor

Servo lockServo; 

void setup() {
  // 1. Start the Serial connection so we can talk to the Mac later
  Serial.begin(9600);
  
  // 2. Setup LEDs as Outputs
  pinMode(LED_LOCKED_PIN, OUTPUT);
  pinMode(LED_UNLOCKED_PIN, OUTPUT);
  
  // 3. Setup Buttons with internal pull-up resistors! (The Senior Hack)
  pinMode(BUTTON_CYCLE_PIN, INPUT_PULLUP);
  pinMode(BUTTON_ENTER_PIN, INPUT_PULLUP);
  
  // 4. Attach and calibrate the servo
  lockServo.attach(SERVO_PIN);
  lockServo.write(0); // Force the motor to absolute zero (Locked state)
  
  // 5. Set initial LED state
  digitalWrite(LED_LOCKED_PIN, HIGH); // Turn Red ON
  digitalWrite(LED_UNLOCKED_PIN, LOW);  // Turn Green OFF
  
  Serial.println("System Booted. Awaiting diagnostics...");
}

void loop() {
  // Note: Because we use INPUT_PULLUP, a pressed button reads as LOW.
  bool cyclePressed = digitalRead(BUTTON_CYCLE_PIN) == LOW;
  bool enterPressed = digitalRead(BUTTON_ENTER_PIN) == LOW;

  // Test 1: If Button 1 is pressed -> Unlock State
  if (cyclePressed) {
    digitalWrite(LED_LOCKED_PIN, LOW);    // Red OFF
    digitalWrite(LED_UNLOCKED_PIN, HIGH); // Green ON
    lockServo.write(90);                  // Move Servo to 90 degrees
    Serial.println("Diagnostics: Unlock Triggered");
    delay(200); // Tiny debounce delay
  }

  // Test 2: If Button 2 is pressed -> Lock State
  if (enterPressed) {
    digitalWrite(LED_LOCKED_PIN, HIGH);   // Red ON
    digitalWrite(LED_UNLOCKED_PIN, LOW);  // Green OFF
    lockServo.write(0);                   // Move Servo back to 0 degrees
    Serial.println("Diagnostics: Lock Triggered");
    delay(200); // Tiny debounce delay
  }
}