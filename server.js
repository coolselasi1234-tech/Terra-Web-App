const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/telemetry', (req, res) => {
  const batteryVoltage = (12.5 + Math.random() * 0.4).toFixed(2);
  const batteryCurrent = (2.0 + Math.random() * 1.0).toFixed(2);
  const temperature = (26 + Math.random() * 3).toFixed(1);
  const humidity = (60 + Math.random() * 8).toFixed(1);
  const pressure = (1010 + Math.random() * 6).toFixed(0);
  const mcuTemp = (42 + Math.random() * 5).toFixed(1);

  const signals = ['STRONG', 'GOOD', 'FAIR'];
  const signalStrength = signals[Math.floor(Math.random() * signals.length)];

  res.json({
    battery_voltage: batteryVoltage,
    battery_current: batteryCurrent,
    temperature: temperature,
    humidity: humidity,
    pressure: pressure,
    mcu_temp: mcuTemp,
    signal_strength: signalStrength
  });
});

app.use(express.static(path.join(__dirname, 'frontend', 'build')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});