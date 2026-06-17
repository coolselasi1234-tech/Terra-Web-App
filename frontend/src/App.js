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
    mcu: [],
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
              temperature: [...prev.temperature, Number(newData.temperature)].slice(-maxPoints),
              humidity: [...prev.humidity, Number(newData.humidity)].slice(-maxPoints),
              pressure: [...prev.pressure, Number(newData.pressure)].slice(-maxPoints),
              voltage: [...prev.voltage, Number(newData.battery_voltage)].slice(-maxPoints),
              current: [...prev.current, Number(newData.battery_current)].slice(-maxPoints),
              mcu: [...prev.mcu, Number(newData.mcu_temp)].slice(-maxPoints),
            };
          });
        })
        .catch((err) => console.error('Error fetching telemetry:', err));
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1000);

    return () => clearInterval(interval);
  }, []);

  const temperatureChartData = {
    labels: history.time,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: history.temperature,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.3,
      },
    ],
  };

  const voltageChartData = {
    labels: history.time,
    datasets: [
      {
        label: 'Battery Voltage (V)',
        data: history.voltage,
        borderColor: 'rgb(255, 206, 86)',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        tension: 0.3,
      },
    ],
  };

  const humidityChartData = {
    labels: history.time,
    datasets: [
      {
        label: 'Humidity (%)',
        data: history.humidity,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">TERRA</h2>

        <button
          className={`nav-button ${page === 'home' ? 'active' : ''}`}
          onClick={() => setPage('home')}
        >
          HOME
        </button>

        <button
          className={`nav-button ${page === 'log' ? 'active' : ''}`}
          onClick={() => setPage('log')}
        >
          LOG
        </button>

        <button
          className={`nav-button ${page === 'settings' ? 'active' : ''}`}
          onClick={() => setPage('settings')}
        >
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
              <div className="camera-placeholder">
                Camera stream will go here
              </div>
            </div>

            <div className="card">
              <h3>Battery Status</h3>
              {data ? (
                <>
                  <p>Voltage: {data.battery_voltage} V</p>
                  <p>Current: {data.battery_current} A</p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </div>

            <div className="card">
              <h3>Atmospheric Sensors</h3>
              {data ? (
                <>
                  <p>Temperature: {data.temperature} °C</p>
                  <p>Humidity: {data.humidity} %</p>
                  <p>Pressure: {data.pressure} hPa</p>
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
              <h3>Temperature vs Time</h3>
              <Line data={temperatureChartData} />
            </div>

            <div className="card">
              <h3>Battery Voltage vs Time</h3>
              <Line data={voltageChartData} />
            </div>

            <div className="card">
              <h3>Humidity vs Time</h3>
              <Line data={humidityChartData} />
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
              <div className="camera-placeholder">
                Settings controls will go here next
              </div>
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