import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CandidateForm from './pages/CandidateForm';
import VideoRecorder from './pages/VideoRecorder';
import Review from './pages/Review';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CandidateForm />} />
        <Route path="/record" element={<VideoRecorder />} />
        <Route path="/review" element={<Review />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
