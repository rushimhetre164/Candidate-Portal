import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Review() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const id = new URLSearchParams(window.location.search).get('candidateId');

  useEffect(() => {
    (async () => {
      const res = await api.getCandidate(id);
      setData(res);
    })();
  }, [id]);

  if (!id) return <div className="page-container red-box">Missing candidate ID</div>;
  if (!data) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      <h2>Review Candidate</h2>

      <div className="blue-box">
        Below is your information along with resume download link and recorded video.
      </div>

      <div className="mb-4">
        <strong>Name:</strong> {data.firstName} {data.lastName}<br />
        <strong>Position Applied:</strong> {data.positionApplied}<br />
        <strong>Current Position:</strong> {data.currentPosition}<br />
        <strong>Experience:</strong> {data.experienceYears} years
      </div>

      {data.resumeFileId && (
        <div className="mb-4">
          <a className="btn btn-primary" href={`${api.baseURL}/api/file/resume/${data.resumeFileId}`} target="_blank" rel="noreferrer">
            Download Resume (PDF)
          </a>
        </div>
      )}

      {data.videoFileId ? (
        <video
          controls
          className="w-100 rounded border"
          src={`${api.baseURL}/api/file/video/${data.videoFileId}`}
        ></video>
      ) : (
        <div className="red-box">
          No video was uploaded.
        </div>
      )}

      <button
        className="btn btn-outline-secondary w-100 mt-4"
        onClick={() => navigate('/')}
      >
        Back to Home
      </button>
    </div>
  );
}
