const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;

// Change this if your Arduino/ESP32 uses a different COM port
const ARDUINO_PORT = 'COM6';

app.use(cors());
app.use(express.json());

let latestSensorData = {
  tempC: null,
  tempF: null,
  soilMoistureFrequency: null,
  batteryVoltage: null,
  batteryCurrent: null,
  batteryPower: null,
  status: 'Waiting for Arduino data'
};

try {
  const arduinoPort = new SerialPort({
    path: ARDUINO_PORT,
    baudRate: 115200
  });

  const parser = arduinoPort.pipe(
    new ReadlineParser({ delimiter: '\r\n' })
  );

  parser.on('data', (line) => {
    console.log('Arduino:', line);

    // Example: Frequency: 2680.96 Hz
    const frequencyMatch = line.match(/Frequency:\s*([-0-9.]+)\s*Hz/);
    if (frequencyMatch) {
      latestSensorData.soilMoistureFrequency = parseFloat(frequencyMatch[1]);
      latestSensorData.status = 'Connected';
    }

    // Example: TEMP_C:25.94,TEMP_F:78.80
    const tempMatch = line.match(/TEMP_C:([-0-9.]+),TEMP_F:([-0-9.]+)/);
    if (tempMatch) {
      latestSensorData.tempC = parseFloat(tempMatch[1]);
      latestSensorData.tempF = parseFloat(tempMatch[2]);
      latestSensorData.status = 'Connected';
    }

    // Example: Voltage: 12.730 V   Current: 2.880 A   Power: 36.662 W
    const powerMatch = line.match(
      /Voltage:\s*([-0-9.]+)\s*V\s*Current:\s*([-0-9.]+)\s*A\s*Power:\s*([-0-9.]+)\s*W/
    );

    if (powerMatch) {
      latestSensorData.batteryVoltage = parseFloat(powerMatch[1]);
      latestSensorData.batteryCurrent = parseFloat(powerMatch[2]);
      latestSensorData.batteryPower = parseFloat(powerMatch[3]);
      latestSensorData.status = 'Connected';
    }

    if (line.includes('No signal detected')) {
      latestSensorData.status = 'No moisture signal detected';
      latestSensorData.soilMoistureFrequency = null;
    }
  });

  arduinoPort.on('open', () => {
    console.log(`Connected to Arduino on ${ARDUINO_PORT}`);
    latestSensorData.status = 'Connected to Arduino';
  });

  arduinoPort.on('error', (err) => {
    console.error('Arduino serial error:', err.message);
    latestSensorData.status = 'Arduino serial error';
  });

} catch (err) {
  console.error('Could not open Arduino serial port:', err.message);
  latestSensorData.status = 'Arduino not connected';
}

app.get('/api/telemetry', (req, res) => {
  const humidity = (60 + Math.random() * 8).toFixed(1);
  const pressure = (1010 + Math.random() * 6).toFixed(0);
  const mcuTemp = (42 + Math.random() * 5).toFixed(1);

  const signals = ['STRONG', 'GOOD', 'FAIR'];
  const signalStrength = signals[Math.floor(Math.random() * signals.length)];

  res.json({
    battery_voltage:
      latestSensorData.batteryVoltage !== null
        ? latestSensorData.batteryVoltage.toFixed(3)
        : null,

    battery_current:
      latestSensorData.batteryCurrent !== null
        ? latestSensorData.batteryCurrent.toFixed(3)
        : null,

    battery_power:
      latestSensorData.batteryPower !== null
        ? latestSensorData.batteryPower.toFixed(3)
        : null,

    temperature:
      latestSensorData.tempC !== null
        ? latestSensorData.tempC.toFixed(1)
        : null,

    temperature_f:
      latestSensorData.tempF !== null
        ? latestSensorData.tempF.toFixed(1)
        : null,

    humidity: humidity,
    pressure: pressure,
    mcu_temp: mcuTemp,
    signal_strength: signalStrength,
    temperature_status: latestSensorData.status,

    soil_moisture_frequency:
      latestSensorData.soilMoistureFrequency !== null
        ? latestSensorData.soilMoistureFrequency.toFixed(2)
        : null,

    soil_temperature_f:
      latestSensorData.tempF !== null
        ? latestSensorData.tempF.toFixed(1)
        : null
  });
});

app.use(express.static(path.join(__dirname, 'frontend', 'build')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Reading Arduino/ESP32 sensor data from ${ARDUINO_PORT}`);
});