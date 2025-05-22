import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';


export default function VideoChat() {
      const navigate = useNavigate();
      const localVideoRef = useRef(null);
      const [remoteStreams, setRemoteStreams] = useState({});
      const [users, setUsers] = useState([]);
      const [socket, setSocket] = useState(null);
      const peerConnections = useRef({});
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

        // Initialize local video
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(err => console.error('Error accessing media devices:', err));

        newSocket.emit('join', { roomId, username });

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
        });

        newSocket.on('offer', async ({ offer, from }) => {
          if (!peerConnections.current[from]) {
            createPeerConnection(from, newSocket);
          }
          await peerConnections.current[from].setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnections.current[from].createAnswer();
          await peerConnections.current[from].setLocalDescription(answer);
          newSocket.emit('answer', { answer, to: from });
        });

        newSocket.on('answer', async ({ answer, from }) => {
          await peerConnections.current[from].setRemoteDescription(new RTCSessionDescription(answer));
        });

        newSocket.on('ice-candidate', async ({ candidate, from }) => {
          if (peerConnections.current[from]) {
            await peerConnections.current[from].addIceCandidate(new RTCIceCandidate(candidate));
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
            {
                urls: 'stun:stun.l.google.com:19302' // STUN Google (phụ trợ)
                },
                {
                urls: 'turn:relay1.expressturn.com:3480',
                username: '174728286587966325',
                credential: 'gcQpxGMmZ/HwbtAVAw1JbDV+6CU='
            }]
        });
        peerConnections.current[userId] = pc;

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
          });

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
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { offer, to: userId });
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
              <video ref={localVideoRef} className="w-100 border rounded" autoPlay muted />
            </div>
            {users.map(user => (
              <div key={user.id} className="col-md-6 mb-3">
                <h5>{user.username}'s Video</h5>
                <video
                  className="w-100 border rounded"
                  autoPlay
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
