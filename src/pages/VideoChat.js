import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

export default function VideoChat() {
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [users, setUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const peerConnections = useRef({});
  const pendingCandidates = useRef({});

  const searchParams = new URLSearchParams(window.location.search);
  const roomId = searchParams.get('roomId');
  const username = searchParams.get('username');

  useEffect(() => {
    if (!roomId || !username) {
      navigate('/');
      return;
    }

    const newSocket = io("https://3.106.188.116.nip.io", {
      transports: ["websocket", "polling"]
    });
    setSocket(newSocket);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        newSocket.emit('join', { roomId, username });
      })
      .catch(err => console.error('Error accessing media devices:', err));

    newSocket.on('all-users', (otherUsers) => {
      setUsers(otherUsers);
      otherUsers.forEach(user => {
        createPeerConnection(user.id, newSocket);
      });
    });

    newSocket.on('user-joined', ({ id, username }) => {
      setUsers(prev => [...prev, { id, username }]);
      createPeerConnection(id, newSocket);
    });

    newSocket.on('user-left', ({ id }) => {
      setUsers(prev => prev.filter(user => user.id !== id));
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[id];
        return newStreams;
      });
      if (peerConnections.current[id]) {
        peerConnections.current[id].close();
        delete peerConnections.current[id];
      }
      delete pendingCandidates.current[id];
    });

    newSocket.on('offer', async ({ offer, from }) => {
      let pc = peerConnections.current[from];
      if (!pc) {
        createPeerConnection(from, newSocket);
        pc = peerConnections.current[from];
      }

      try {
        if (pc.signalingState === 'have-local-offer') {
          console.warn(`Skipping offer: signalingState = ${pc.signalingState}`);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Xử lý các ICE candidate bị nhận sớm
        if (pendingCandidates.current[from]) {
          for (const candidate of pendingCandidates.current[from]) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          delete pendingCandidates.current[from];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newSocket.emit('answer', { answer, to: from });
      } catch (err) {
        console.error('Failed to handle offer:', err);
      }
    });

    newSocket.on('answer', async ({ answer, from }) => {
      const pc = peerConnections.current[from];
      if (!pc) return;

      try {
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.warn(`Skipping answer: unexpected signalingState = ${pc.signalingState}`);
        }
      } catch (err) {
        console.error('Failed to set remote description (answer):', err);
      }
    });

    newSocket.on('ice-candidate', async ({ candidate, from }) => {
      const pc = peerConnections.current[from];

      if (!pc || !pc.remoteDescription) {
        // Nếu chưa có peer hoặc chưa set remoteDescription, lưu vào buffer
        if (!pendingCandidates.current[from]) {
          pendingCandidates.current[from] = [];
        }
        pendingCandidates.current[from].push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    return () => {
      newSocket.disconnect();
      Object.values(peerConnections.current).forEach(pc => pc.close());
    };
  }, [roomId, username]);

  const createPeerConnection = (userId, socket) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:relay1.expressturn.com:3480',
          username: '174728286587966325',
          credential: 'gcQpxGMmZ/HwbtAVAw1JbDV+6CU='
        }
      ]
    });

    peerConnections.current[userId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: event.streams[0]
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { offer, to: userId });
      } catch (err) {
        console.error('Negotiation error:', err);
      }
    };
  };

  return (
    <div className="container mt-3">
      <h1 className="mb-4">Video Chat - Room: {roomId}</h1>
      <div className="mb-3">
        <button className="btn btn-danger" onClick={() => navigate('/')}>Leave Room</button>
      </div>
      <div className="row">
        <div className="col-md-6 mb-3">
          <h5>Your Video</h5>
          <video ref={localVideoRef} className="w-100 border rounded" autoPlay muted playsInline />
        </div>
        {users.map(user => (
          <div key={user.id} className="col-md-6 mb-3">
            <h5>{user.username}'s Video</h5>
            <video
              className="w-100 border rounded"
              autoPlay
              playsInline
              ref={video => {
                if (video && remoteStreams[user.id]) {
                  video.srcObject = remoteStreams[user.id];
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-body">
          <h5>Users in Room:</h5>
          <ul className="list-group">
            <li className="list-group-item">{username} (You)</li>
            {users.map(user => (
              <li key={user.id} className="list-group-item">{user.username}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
