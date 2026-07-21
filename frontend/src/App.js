import React, { useEffect, useState } from 'react';
import './App.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState('home');

  const [history, setHistory] = useState({
    time: [],
    temperature: [],
    humidity: [],
    pressure: [],
    voltage: [],
    current: [],
    power: [],
    mcu: [],
    soilMoistureFrequency: [],
    soilTemperatureF: []
  });

  useEffect(() => {
    const fetchTelemetry = () => {
      fetch('/api/telemetry')
        .then((res) => res.json())
        .then((newData) => {
          setData(newData);

          setHistory((prev) => {
            const maxPoints = 20;

            return {
              time: [...prev.time, new Date().toLocaleTimeString()].slice(-maxPoints),
              temperature: [...prev.temperature, Number(newData.temperature || 0)].slice(-maxPoints),
              humidity: [...prev.humidity, Number(newData.humidity || 0)].slice(-maxPoints),
              pressure: [...prev.pressure, Number(newData.pressure || 0)].slice(-maxPoints),
              voltage: [...prev.voltage, Number(newData.battery_voltage || 0)].slice(-maxPoints),
              current: [...prev.current, Number(newData.battery_current || 0)].slice(-maxPoints),
              power: [...prev.power, Number(newData.battery_power || 0)].slice(-maxPoints),
              mcu: [...prev.mcu, Number(newData.mcu_temp || 0)].slice(-maxPoints),
              soilMoistureFrequency: [
                ...prev.soilMoistureFrequency,
                Number(newData.soil_moisture_frequency || 0)
              ].slice(-maxPoints),
              soilTemperatureF: [
                ...prev.soilTemperatureF,
                Number(newData.soil_temperature_f || 0)
              ].slice(-maxPoints)
            };
          });
        })
        .catch((err) => console.error('Error fetching telemetry:', err));
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1000);

    return () => clearInterval(interval);
  }, []);

  const makeChart = (label, values, borderColor, backgroundColor) => ({
    labels: history.time,
    datasets: [
      {
        label,
        data: values,
        borderColor,
        backgroundColor,
        tension: 0.3
      }
    ]
  });

  const temperatureChartData = makeChart(
    'Atmospheric Temperature (°C)',
    history.temperature,
    'rgb(75, 192, 192)',
    'rgba(75, 192, 192, 0.2)'
  );

  const batteryVoltageCurrentChartData = {
    labels: history.time,
    datasets: [
      {
        label: 'Battery Voltage (V)',
        data: history.voltage,
        borderColor: 'rgb(255, 206, 86)',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Battery Current (A)',
        data: history.current,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.3,
      },
    ],
  };

  const humidityChartData = makeChart(
    'Humidity (%)',
    history.humidity,
    'rgb(54, 162, 235)',
    'rgba(54, 162, 235, 0.2)'
  );

  const soilMoistureChartData = makeChart(
    'Moisture Frequency (Hz)',
    history.soilMoistureFrequency,
    'rgb(153, 102, 255)',
    'rgba(153, 102, 255, 0.2)'
  );

  const soilTemperatureChartData = makeChart(
    'Soil Temperature (°F)',
    history.soilTemperatureF,
    'rgb(255, 99, 132)',
    'rgba(255, 99, 132, 0.2)'
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">TERRA</h2>

        <button className={`nav-button ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
          HOME
        </button>

        <button className={`nav-button ${page === 'log' ? 'active' : ''}`} onClick={() => setPage('log')}>
          LOG
        </button>

        <button className={`nav-button ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
          SETTINGS
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h1>Terra Environmental Observation Rover</h1>
          <div className="status-badge">OPERATIONAL</div>
        </header>

        {page === 'home' && (
          <section className="dashboard-grid">
            <div className="card live-feed">
              <h3>Live Camera Feed</h3>
              <div className="camera-placeholder">Camera stream will go here</div>
            </div>

            <div className="card">
              <h3>Battery Status</h3>
              {data ? (
                <>
                  <p>Voltage: {data.battery_voltage !== null ? data.battery_voltage : 'N/A'} V</p>
                  <p>Current: {data.battery_current !== null ? data.battery_current : 'N/A'} A</p>
                  <p>Power: {data.battery_power !== null ? data.battery_power : 'N/A'} W</p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </div>

            <div className="card">
              <h3>Atmospheric Sensors</h3>
              {data ? (
                <>
                  <p>Temperature: {data.temperature !== null ? data.temperature : 'N/A'} °C</p>
                  <p>Humidity: {data.humidity} %</p>
                  <p>Pressure: {data.pressure} hPa</p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </div>

            <div className="card">
              <h3>Soil Sensors</h3>
              {data ? (
                <>
                  <p>Moisture Frequency: {data.soil_moisture_frequency !== null ? data.soil_moisture_frequency : 'N/A'} Hz</p>
                  <p>Soil Temperature: {data.soil_temperature_f !== null ? data.soil_temperature_f : 'N/A'} °F</p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </div>

            <div className="card">
              <h3>System Status</h3>
              {data ? (
                <>
                  <p>MCU Temp: {data.mcu_temp} °C</p>
                  <p>Signal Strength: {data.signal_strength}</p>
                  <p>Sensor Status: {data.temperature_status}</p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </div>
          </section>
        )}

        {page === 'log' && (
          <section className="dashboard-grid">
            <div className="card live-feed">
              <h3>Atmospheric Temperature vs Time</h3>
              <Line data={temperatureChartData} />
            </div>

            <div className="card">
              <h3>Battery Voltage and Current vs Time</h3>
              <Line data={batteryVoltageCurrentChartData} />
            </div>

            <div className="card">
              <h3>Humidity vs Time</h3>
              <Line data={humidityChartData} />
            </div>

            <div className="card">
              <h3>Soil Moisture Frequency vs Time</h3>
              <Line data={soilMoistureChartData} />
            </div>

            <div className="card">
              <h3>Soil Temperature vs Time</h3>
              <Line data={soilTemperatureChartData} />
            </div>

            <div className="card">
              <h3>System Log</h3>
              <p>MCU Temp vs Time (coming next)</p>
              <p>Signal Strength vs Time (coming next)</p>
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="dashboard-grid">
            <div className="card live-feed">
              <h3>Settings</h3>
              <div className="camera-placeholder">Settings controls will go here next</div>
            </div>

            <div className="card">
              <h3>Control Settings</h3>
              <p>Joystick Sensitivity</p>
              <p>Max Speed Limit</p>
            </div>

            <div className="card">
              <h3>Communication Settings</h3>
              <p>Telemetry Update Rate</p>
              <p>Connection Timeout</p>
            </div>

            <div className="card">
              <h3>Safety Settings</h3>
              <p>Low Battery Warning</p>
              <p>Failsafe Threshold</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;