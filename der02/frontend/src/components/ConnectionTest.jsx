import React, { useState } from 'react';
import { apiClient } from '../api/client';

const ConnectionTest = () => {
  const [pingResult, setPingResult] = useState('');
  const [inputText, setInputText] = useState('');
  const [saveResult, setSaveResult] = useState('');
  const [messages, setMessages] = useState([]);

  const handlePing = async () => {
    try {
      const res = await apiClient.get('/api/ping');
      setPingResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setPingResult('Error: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!inputText) return;
    try {
      const res = await apiClient.post('/api/test-db', { message: inputText });
      setSaveResult(`Success: Saved row id ${res.data.id}`);
      setInputText('');
    } catch (err) {
      setSaveResult('Error: ' + err.message);
    }
  };

  const handleLoad = async () => {
    try {
      const res = await apiClient.get('/api/test-db');
      setMessages(res.data);
    } catch (err) {
      setMessages([{ id: 'err', message: 'Error: ' + err.message }]);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Backend Connection Test</h2>
      
      {/* Ping Test */}
      <div className="space-y-2">
        <button 
          onClick={handlePing}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition"
        >
          Ping Backend
        </button>
        {pingResult && <pre className="bg-gray-100 p-2 text-sm rounded text-gray-700">{pingResult}</pre>}
      </div>

      <hr />

      {/* Write DB */}
      <div className="space-y-2">
        <div className="flex space-x-2">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium transition"
          >
            Save to DB
          </button>
        </div>
        {saveResult && <p className="text-sm text-green-700 font-medium">{saveResult}</p>}
      </div>

      <hr />

      {/* Read DB */}
      <div className="space-y-2">
        <button 
          onClick={handleLoad}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium transition"
        >
          Load Saved Messages
        </button>
        {messages.length > 0 && (
          <ul className="bg-gray-50 border rounded divide-y divide-gray-200 max-h-40 overflow-y-auto">
            {messages.map(msg => (
              <li key={msg.id} className="p-2 text-sm text-gray-700">
                <span className="font-semibold text-gray-500">[{msg.id}]</span> {msg.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConnectionTest;
