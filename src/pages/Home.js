// src/components/Home.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default  function Home() {
      const navigate = useNavigate();
      const [username, setUsername] = useState('');
      const [roomId, setRoomId] = useState('');

      const handleJoin = (e) => {
        e.preventDefault();
        if (username && roomId) {
          navigate(`/videochat?roomId=${roomId}&username=${username}`);
        }
      };

      return (
        <div className="container mt-5">
          <h1 className="text-center mb-4">Video Chat App</h1>
          <div className="card mx-auto" style={{ maxWidth: '400px' }}>
            <div className="card-body">
              <form onSubmit={handleJoin}>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="roomId" className="form-label">Room ID</label>
                  <input
                    type="text"
                    className="form-control"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100">Join Room</button>
              </form>
            </div>
          </div>
        </div>
      );
}