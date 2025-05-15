// src/socket.js
import { io } from 'socket.io-client';
const socket = io('http://localhost:5090');
export default socket;
