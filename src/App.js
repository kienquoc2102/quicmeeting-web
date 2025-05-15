import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import VideoChat from './pages/VideoChat';
import Home from './pages/Home';

function App() {
  return (
    <Router>
      <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/videochat" element={<VideoChat />} />
      </Routes>
    </Router>
  );
}

export default App;
